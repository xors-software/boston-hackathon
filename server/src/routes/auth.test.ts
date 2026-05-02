import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { authRoutes } from "./auth";

function buildApp() {
	return new Elysia().use(authRoutes);
}

describe("GET /auth/me", () => {
	it("returns 401 when no session cookie is present", async () => {
		const app = buildApp();
		const res = await app.handle(
			new Request("http://localhost/auth/me"),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Not authenticated" });
	});

	it("returns 401 when the session cookie can't be resolved", async () => {
		// A garbage session value still hits api.xors.xyz; that fetch will
		// either fail or return non-ok, both of which resolve to null.
		// We can't intercept the network call without rewiring the module,
		// but we can assert the contract: garbage in → 401 out.
		const app = buildApp();
		const res = await app.handle(
			new Request("http://localhost/auth/me", {
				headers: { cookie: "xors_session=not-a-real-key" },
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe("POST /auth/logout", () => {
	it("returns ok and sets a clearing Set-Cookie", async () => {
		const app = buildApp();
		const res = await app.handle(
			new Request("http://localhost/auth/logout", { method: "POST" }),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toContain("xors_session=");
		expect(setCookie).toContain("Max-Age=0");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("Path=/");
	});
});
