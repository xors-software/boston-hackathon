// Integration test that hits the REAL api.xors.xyz. Gated on
// INTEGRATION=1 so it doesn't run in normal test suites — opt-in
// because (a) it requires network and (b) it mints a real user
// account on the production identity service.
//
// Usage:
//   INTEGRATION=1 bun test src/routes/auth-login.integration.test.ts
//
// Override the test account by setting INTEGRATION_TEST_EMAIL and
// INTEGRATION_TEST_PASSWORD; otherwise a fresh email is generated
// per run (which will create one new account in the xors users
// table — that's the cost of opt-in network testing).

import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { authRoutes } from "./auth";

const SHOULD_RUN = process.env.INTEGRATION === "1";
const dscribe = SHOULD_RUN ? describe : describe.skip;

const TEST_EMAIL =
	process.env.INTEGRATION_TEST_EMAIL ||
	`boston-hackathon-test-${Date.now()}@example.test`;
const TEST_PASSWORD =
	process.env.INTEGRATION_TEST_PASSWORD || `pw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function buildApp() {
	return new Elysia().use(authRoutes);
}

function extractSessionCookie(setCookie: string | null): string | null {
	if (!setCookie) return null;
	const match = setCookie.match(/xors_session=([^;]+)/);
	return match?.[1] ?? null;
}

dscribe("integration: real api.xors.xyz round-trip", () => {
	it(
		"login → /auth/me → wrong-password 401",
		async () => {
			const app = buildApp();

			console.log("[integration] using test email:", TEST_EMAIL);

			// First login — auto-creates the account if email is unseen,
			// returns the existing user otherwise.
			const loginRes = await app.handle(
				new Request("http://localhost/auth/login", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						email: TEST_EMAIL,
						password: TEST_PASSWORD,
					}),
				}),
			);
			expect(loginRes.status).toBe(200);
			const loginBody = await loginRes.json();
			expect(loginBody).toEqual({ ok: true });

			const sessionKey = extractSessionCookie(
				loginRes.headers.get("set-cookie"),
			);
			expect(sessionKey).toBeTruthy();
			expect(sessionKey?.length ?? 0).toBeGreaterThan(20);

			// /auth/me with the cookie resolves to the same user.
			const meRes = await app.handle(
				new Request("http://localhost/auth/me", {
					headers: { cookie: `xors_session=${sessionKey}` },
				}),
			);
			expect(meRes.status).toBe(200);
			const me = (await meRes.json()) as {
				user: { id: string; email: string; displayName: string | null };
			};
			expect(me.user.email).toBe(TEST_EMAIL.toLowerCase());
			expect(me.user.id).toMatch(/^usr_/);

			// Re-login with same creds (existing-user path).
			const loginAgain = await app.handle(
				new Request("http://localhost/auth/login", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						email: TEST_EMAIL,
						password: TEST_PASSWORD,
					}),
				}),
			);
			expect(loginAgain.status).toBe(200);

			// Wrong password rejected.
			const wrongPw = await app.handle(
				new Request("http://localhost/auth/login", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						email: TEST_EMAIL,
						password: `${TEST_PASSWORD}-WRONG`,
					}),
				}),
			);
			expect(wrongPw.status).toBe(401);
			expect(await wrongPw.json()).toEqual({
				error: "Wrong email or password.",
			});

			// Logout clears the cookie.
			const logoutRes = await app.handle(
				new Request("http://localhost/auth/logout", { method: "POST" }),
			);
			expect(logoutRes.status).toBe(200);
			const clearCookie = logoutRes.headers.get("set-cookie");
			expect(clearCookie).toContain("Max-Age=0");
		},
		30_000,
	);
});
