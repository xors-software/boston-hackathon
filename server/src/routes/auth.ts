import { Elysia, t } from "elysia";
import { authContext, XORS_SESSION_COOKIE } from "../lib/xors-identity";

const COOKIE_SECURE =
	(process.env.SESSION_COOKIE_SECURE ?? "true").toLowerCase() !== "false";
const COOKIE_SAMESITE = process.env.SESSION_COOKIE_SAMESITE || "Lax";

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
		"/logout",
		({ set }) => {
			set.headers["set-cookie"] = clearXorsCookie();
			return { ok: true as const };
		},
		{
			response: t.Object({ ok: t.Literal(true) }),
			detail: { summary: "Clear session cookie", tags: ["Auth"] },
		},
	);
