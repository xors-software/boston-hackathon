// Auth-gating tests only — happy-path coverage now lives in
// messages.integration.test.ts (gated on INTEGRATION=1) since the
// route handlers write to Postgres. Keeping these here means the
// default `bun test` stays fast, network-free, and DB-free.

import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { messagesRoutes } from "./messages";

function buildApp() {
	return new Elysia().use(messagesRoutes);
}

describe("messages routes — unauthenticated", () => {
	it("GET /messages → 401", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/messages"),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Not authenticated" });
	});

	it("GET /messages/with/:userId → 401", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/messages/with/usr_anything"),
		);
		expect(res.status).toBe(401);
	});

	it("GET /messages/recipients → 401", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/messages/recipients"),
		);
		expect(res.status).toBe(401);
	});

	it("POST /messages → 401", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ toUserId: "usr_x", content: "hi" }),
			}),
		);
		expect(res.status).toBe(401);
	});
});
