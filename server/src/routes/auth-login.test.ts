// /auth/login tests live in their own file so they don't conflict with
// the /auth/me + /auth/logout tests added in the test PR (#2). Once
// both land, a future cleanup can consolidate into a single auth.test.ts.

import { afterEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { authRoutes } from "./auth";

function buildApp() {
	return new Elysia().use(authRoutes);
}

interface StubResponse {
	ok: boolean;
	body: unknown;
}

// /auth/login proxies to api.xors.xyz/api/users/authenticate. Stub
// globalThis.fetch so we can assert the route handler's behavior
// without standing up the real identity service.
function stubAuthenticateFetch(
	respond: (creds: { email: string; password: string }) => StubResponse,
): { restore: () => void } {
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = typeof input === "string" ? input : input.toString();
		if (url.includes("/api/users/authenticate")) {
			const raw = init?.body;
			const parsed =
				typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : {};
			const result = respond({
				email: String(parsed.email ?? ""),
				password: String(parsed.password ?? ""),
			});
			return new Response(JSON.stringify(result.body), {
				status: result.ok ? 200 : 401,
				headers: { "content-type": "application/json" },
			});
		}
		return realFetch(input, init);
	}) as typeof fetch;
	return {
		restore: () => {
			globalThis.fetch = realFetch;
		},
	};
}

describe("POST /auth/login", () => {
	let stub: { restore: () => void } | null = null;

	afterEach(() => {
		stub?.restore();
		stub = null;
	});

	it("returns 401 when xors rejects the credentials", async () => {
		stub = stubAuthenticateFetch(() => ({
			ok: false,
			body: { error: true, message: "wrong password" },
		}));
		const res = await buildApp().handle(
			new Request("http://localhost/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "test@example.com", password: "nope" }),
			}),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Wrong email or password." });
	});

	it("sets the xors_session cookie when xors returns a session key", async () => {
		stub = stubAuthenticateFetch(() => ({
			ok: true,
			body: { user: { key: "test-session-key-abc" } },
		}));
		const res = await buildApp().handle(
			new Request("http://localhost/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: "test@example.com",
					password: "correct",
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toContain("xors_session=test-session-key-abc");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("Path=/");
		expect(setCookie).toMatch(/Max-Age=\d+/);
	});

	it("returns 401 when xors returns ok but no session key", async () => {
		stub = stubAuthenticateFetch(() => ({
			ok: true,
			body: { user: {} },
		}));
		const res = await buildApp().handle(
			new Request("http://localhost/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "x@y.test", password: "z" }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects bodies missing email or password with a 4xx", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/auth/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "" }),
			}),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});
});
