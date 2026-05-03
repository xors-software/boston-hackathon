import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { authRoutes } from "./auth";
import { messagesRoutes } from "./messages";

function buildApp() {
	return new Elysia().use(authRoutes).use(messagesRoutes);
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

// Happy-path coverage. The auth layer's only external call is a fetch
// to api.xors.xyz/api/users/viewer — stubbing globalThis.fetch lets us
// simulate any signed-in user without standing up the real identity
// service.

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
			if (!viewer) {
				return new Response("unauthorized", { status: 401 });
			}
			return new Response(JSON.stringify({ viewer }), {
				status: 200,
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

describe("messages routes — authenticated", () => {
	let stub: { restore: () => void };

	// Use unique xors ids per describe so we're not polluted by users
	// upserted by other test files that share the in-memory store.
	const aliceXors = `xors_alice_${Math.random().toString(36).slice(2, 8)}`;
	const bobXors = `xors_bob_${Math.random().toString(36).slice(2, 8)}`;

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
		// Prime both into the user store first.
		await whoAmI("alice_key");
		await whoAmI("bob_key");
		const alice = await whoAmI("alice_key");

		const view = await recipientsOf("alice_key");
		expect(view.users.map((u) => u.id)).not.toContain(alice.id);
	});

	it("send → list round-trips and the recipient sees the message", async () => {
		await whoAmI("alice_key");
		await whoAmI("bob_key");
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

		// Bob's inbox should include the new message.
		const bobInboxRes = await send(
			"bob_key",
			new Request("http://localhost/messages"),
		);
		const bobInbox = (await bobInboxRes.json()) as {
			messages: Array<{ id: string }>;
		};
		expect(bobInbox.messages.some((m) => m.id === message.id)).toBe(true);

		// Conversation endpoint returns the same message from Bob's POV.
		const convRes = await send(
			"bob_key",
			new Request(`http://localhost/messages/with/${message.fromUserId}`),
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
					toUserId: "usr_does_not_exist",
					content: "hi",
				}),
			}),
		);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "Recipient not found" });
	});

	it("rejects empty content via body validation", async () => {
		await whoAmI("alice_key");
		await whoAmI("bob_key");
		const bob = await whoAmI("bob_key");

		const res = await send(
			"alice_key",
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ toUserId: bob.id, content: "" }),
			}),
		);
		// Elysia's t.Object validation surfaces as a 4xx (typically 422).
		// Don't pin the exact code in case Elysia changes it; just assert
		// it's a client-side rejection, not a silent 200.
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});
});
