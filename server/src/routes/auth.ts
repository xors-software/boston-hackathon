import { Elysia, t } from "elysia";
import { recipientLogin } from "../lib/gift-store";
import { authContext, XORS_SESSION_COOKIE } from "../lib/xors-identity";

const COOKIE_SECURE =
	(process.env.SESSION_COOKIE_SECURE ?? "true").toLowerCase() !== "false";
const COOKIE_SAMESITE = process.env.SESSION_COOKIE_SAMESITE || "Lax";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches /oauth callback

const XORS_API_URL =
	process.env.XORS_API_URL ||
	process.env.NEXT_PUBLIC_XORS_API_URL ||
	"https://api.xors.xyz";

const XORS_AUTH_SOURCE =
	process.env.XORS_AUTH_SOURCE || "boston-hackathon.local";

function buildXorsCookie(sessionKey: string): string {
	const parts = [
		`${XORS_SESSION_COOKIE}=${sessionKey}`,
		"HttpOnly",
		"Path=/",
		`Max-Age=${COOKIE_MAX_AGE}`,
		`SameSite=${COOKIE_SAMESITE}`,
	];
	if (COOKIE_SECURE) parts.push("Secure");
	return parts.join("; ");
}

function clearXorsCookie(): string {
	const parts = [
		`${XORS_SESSION_COOKIE}=`,
		"HttpOnly",
		"Path=/",
		"Max-Age=0",
		`SameSite=${COOKIE_SAMESITE}`,
	];
	if (COOKIE_SECURE) parts.push("Secure");
	return parts.join("; ");
}

// Proxies to api.xors.xyz/api/users/authenticate. The xors endpoint
// auto-creates accounts on unseen emails — so this serves as both
// sign-in and sign-up. Returns the session key on success, null on any
// failure (network, bad creds).
async function authenticateWithXors(
	email: string,
	password: string,
): Promise<string | null> {
	try {
		const res = await fetch(`${XORS_API_URL}/api/users/authenticate`, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, source: XORS_AUTH_SOURCE }),
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { user?: { key?: string } };
		return body.user?.key ?? null;
	} catch (err) {
		console.error(
			"[auth] xors authenticate failed:",
			err instanceof Error ? err.message : err,
		);
		return null;
	}
}

const userSchema = t.Object({
	id: t.String(),
	email: t.String(),
	displayName: t.Union([t.String(), t.Null()]),
});

export const authRoutes = new Elysia({ prefix: "/auth" })
	.use(authContext)
	.get(
		"/me",
		({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			return {
				user: {
					id: currentUser.id,
					email: currentUser.email,
					displayName: currentUser.displayName,
				},
			};
		},
		{
			response: {
				200: t.Object({ user: userSchema }),
				401: t.Object({ error: t.String() }),
			},
			detail: { summary: "Get current user", tags: ["Auth"] },
		},
	)
	.post(
		"/login",
		async ({ body, set }) => {
			const sessionKey = await authenticateWithXors(body.email, body.password);
			if (!sessionKey) {
				set.status = 401;
				return { error: "Wrong email or password." };
			}
			set.headers["set-cookie"] = buildXorsCookie(sessionKey);
			return { ok: true as const };
		},
		{
			body: t.Object({
				email: t.String({ minLength: 3, maxLength: 256 }),
				password: t.String({ minLength: 1, maxLength: 256 }),
			}),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				401: t.Object({ error: t.String() }),
			},
			detail: {
				summary: "Sign in with email + password via api.xors.xyz",
				tags: ["Auth"],
			},
		},
	)
	.post(
		"/logout",
		({ set }) => {
			set.headers["set-cookie"] = clearXorsCookie();
			return { ok: true as const };
		},
		{
			response: t.Object({ ok: t.Literal(true) }),
			detail: { summary: "Clear session cookie", tags: ["Auth"] },
		},
	)
	// Parent (recipient) login. Distinct from the giver path above —
	// no XORS round-trip; we look up the recipient by email and verify
	// their stored password hash. Returns the access token so the
	// caller can navigate to /r/:token directly.
	.post(
		"/recipient/login",
		async ({ body, set }) => {
			const recipient = await recipientLogin(body.email, body.password);
			if (!recipient) {
				set.status = 401;
				return { error: "Wrong email or password." };
			}
			return {
				ok: true as const,
				token: recipient.accessToken,
				redirectTo: `/r/${recipient.accessToken}/journal`,
			};
		},
		{
			body: t.Object({
				email: t.String({ minLength: 3, maxLength: 320 }),
				password: t.String({ minLength: 1, maxLength: 256 }),
			}),
			response: {
				200: t.Object({
					ok: t.Literal(true),
					token: t.String(),
					redirectTo: t.String(),
				}),
				401: t.Object({ error: t.String() }),
			},
			detail: {
				summary: "Sign in as a recipient (parent flow) by email + password",
				tags: ["Auth"],
			},
		},
	);
