// Integration test for the messages routes against a real Postgres.
// Stubs the xors viewer fetch so we don't have to mint real api.xors.xyz
// users for every run, but the user upserts and message inserts hit
// the actual DB. Gated on INTEGRATION=1 so default `bun test` stays
// fast and DB-free.
//
// Cleanup: each test uses unique xors_user_ids prefixed with
// `bh_test_<random>_`, and afterAll deletes every row matching that
// prefix (cascade drops the messages too).

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { Elysia } from "elysia";
import { closeSql, getSql, runMigrations } from "../lib/pg";
import { authRoutes } from "./auth";
import { messagesRoutes } from "./messages";

const SHOULD_RUN = process.env.INTEGRATION === "1";
const dscribe = SHOULD_RUN ? describe : describe.skip;

const RUN_PREFIX = `bh_test_${Math.random().toString(36).slice(2, 10)}`;

interface FakeViewer {
	id: string;
	email: string;
	username?: string;
}

function stubViewerFetch(byKey: Record<string, FakeViewer | null>): {
	restore: () => void;
} {
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = typeof input === "string" ? input : input.toString();
		if (url.includes("/api/users/viewer")) {
			const headers = new Headers(init?.headers);
			const key = headers.get("X-API-KEY") ?? "";
			const viewer = byKey[key];
			if (!viewer) return new Response("unauthorized", { status: 401 });
			return new Response(JSON.stringify({ viewer }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		return realFetch(input, init);
	}) as typeof fetch;
	return { restore: () => (globalThis.fetch = realFetch) };
}

function buildApp() {
	return new Elysia().use(authRoutes).use(messagesRoutes);
}

dscribe("messages routes — DB-backed happy paths", () => {
	const aliceXors = `${RUN_PREFIX}_alice`;
	const bobXors = `${RUN_PREFIX}_bob`;
	let stub: { restore: () => void };

	beforeAll(async () => {
		await runMigrations();
	});

	beforeEach(() => {
		stub = stubViewerFetch({
			alice_key: {
				id: aliceXors,
				email: `${aliceXors}@x.test`,
				username: "Alice",
			},
			bob_key: { id: bobXors, email: `${bobXors}@x.test`, username: "Bob" },
		});
	});

	afterEach(() => {
		stub.restore();
	});

	afterAll(async () => {
		// Cascade drops any messages keyed on these users.
		const sql = getSql();
		await sql`DELETE FROM users WHERE xors_user_id LIKE ${`${RUN_PREFIX}_%`}`;
		await closeSql();
	});

	async function send(sessionKey: string, req: Request): Promise<Response> {
		req.headers.set("cookie", `xors_session=${sessionKey}`);
		return await buildApp().handle(req);
	}

	async function whoAmI(sessionKey: string): Promise<{ id: string }> {
		const res = await send(
			sessionKey,
			new Request("http://localhost/auth/me"),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: { id: string } };
		return body.user;
	}

	async function recipientsOf(sessionKey: string) {
		const res = await send(
			sessionKey,
			new Request("http://localhost/messages/recipients"),
		);
		expect(res.status).toBe(200);
		return (await res.json()) as {
			users: Array<{ id: string; email: string }>;
		};
	}

	it("recipients excludes the caller themselves", async () => {
		await whoAmI("alice_key");
		await whoAmI("bob_key");
		const alice = await whoAmI("alice_key");

		const view = await recipientsOf("alice_key");
		expect(view.users.map((u) => u.id)).not.toContain(alice.id);
	});

	it("send → list round-trips and the recipient sees the message", async () => {
		await whoAmI("alice_key");
		const bob = await whoAmI("bob_key");

		const sendRes = await send(
			"alice_key",
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ toUserId: bob.id, content: "hello bob" }),
			}),
		);
		expect(sendRes.status).toBe(200);
		const { message } = (await sendRes.json()) as {
			message: {
				id: string;
				content: string;
				toUserId: string;
				fromUserId: string;
			};
		};
		expect(message.content).toBe("hello bob");
		expect(message.toUserId).toBe(bob.id);
		expect(message.fromUserId).toBe(aliceXors);

		// Bob's inbox includes it.
		const bobInboxRes = await send(
			"bob_key",
			new Request("http://localhost/messages"),
		);
		const bobInbox = (await bobInboxRes.json()) as {
			messages: Array<{ id: string }>;
		};
		expect(bobInbox.messages.some((m) => m.id === message.id)).toBe(true);

		// Conversation endpoint returns it from Bob's POV.
		const convRes = await send(
			"bob_key",
			new Request(
				`http://localhost/messages/with/${encodeURIComponent(message.fromUserId)}`,
			),
		);
		expect(convRes.status).toBe(200);
		const conv = (await convRes.json()) as {
			messages: Array<{ id: string }>;
		};
		expect(conv.messages.some((m) => m.id === message.id)).toBe(true);
	});

	it("rejects sending to self with 400", async () => {
		const alice = await whoAmI("alice_key");
		const res = await send(
			"alice_key",
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					toUserId: alice.id,
					content: "talking to myself",
				}),
			}),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: "Cannot send a message to yourself",
		});
	});

	it("rejects sending to a non-existent user with 404", async () => {
		await whoAmI("alice_key");
		const res = await send(
			"alice_key",
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					toUserId: `${RUN_PREFIX}_does_not_exist`,
					content: "hi",
				}),
			}),
		);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "Recipient not found" });
	});

	it("rejects empty content via body validation", async () => {
		await whoAmI("alice_key");
		const bob = await whoAmI("bob_key");

		const res = await send(
			"alice_key",
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ toUserId: bob.id, content: "" }),
			}),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});
});
