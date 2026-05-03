// Integration tests for the parent (recipient) flow added in
// BACKEND_HANDOFF_V2.md §4C/§5.5: journal entries CRUD + photo/audio
// uploads, sharing config + one-time share, recipient account
// credentials + login.
//
// Same harness as recipient.integration.test.ts:
//
//   DATABASE_URL=postgresql://localhost:5432/ember_test \
//   INTEGRATION=1 bun test src/routes/recipient-flow.integration.test.ts
//
// Stubs OpenAI Whisper via globalThis fetch override so audio uploads
// don't need an API key.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { db } from "../db/client";
import { users } from "../db/schema";
import {
	_resetRecipientDataForTests,
	addQuestion,
	createGift,
	patchGift,
	sendGift,
} from "../lib/gift-store";
import {
	_setStorageForTests,
	createInMemoryStorage,
	type InMemoryStorage,
} from "../lib/storage";
import { authRoutes } from "./auth";
import { giftsRoutes } from "./gifts";
import { recipientRoutes } from "./recipient";

const SHOULD_RUN = process.env.INTEGRATION === "1";
const dscribe = SHOULD_RUN ? describe : describe.skip;

const TEST_EMAIL = `recipient-flow-it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
// Per-process suffix so account creds we set on `recipients.email` don't
// collide with leftover rows from prior runs of this test file.
const PROC_SUFFIX = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const procEmail = (prefix: string) => `${prefix}-${PROC_SUFFIX}@test.local`;

function buildApp() {
	return new Elysia().use(authRoutes).use(giftsRoutes).use(recipientRoutes);
}

const realFetch = globalThis.fetch;
let storage: InMemoryStorage;

function stubWhisper(textToReturn: string, opts?: { fail?: boolean }) {
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = typeof input === "string" ? input : input.toString();
		if (url.includes("api.openai.com/v1/audio/transcriptions")) {
			if (opts?.fail) {
				return new Response("upstream error", { status: 500 });
			}
			return new Response(JSON.stringify({ text: textToReturn }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		return realFetch(input, init);
	}) as typeof fetch;
}

async function ensureUser(xorsUserId: string, email: string) {
	await db
		.insert(users)
		.values({ xorsUserId, email })
		.onConflictDoNothing();
}

async function seed() {
	const xorsUserId = `test-${TEST_EMAIL}`;
	await ensureUser(xorsUserId, TEST_EMAIL);
	const gift0 = await createGift(xorsUserId, "mom");
	const gift =
		(await patchGift(gift0.id, xorsUserId, {
			recipientName: "Mom",
			recipientEmail: "mom-flow@test.local",
			personalMessage: "Mom, I made you something. Open whenever.",
			delivery: "email",
		})) ?? gift0;
	const q1 = await addQuestion(gift.id, {
		source: "library",
		templateId: "tpl_ch1",
		text: "What was your favorite room growing up?",
	});
	const q2 = await addQuestion(gift.id, {
		source: "custom",
		text: "Tell me about your wedding day.",
	});
	const q3 = await addQuestion(gift.id, {
		source: "custom",
		text: "What were you thinking on the drive home from the hospital?",
	});
	const sent = await sendGift(gift.id, xorsUserId);
	return { gift, q1, q2, q3, recipient: sent.recipient, xorsUserId };
}

beforeAll(() => {
	process.env.TEST_USER_EMAIL = TEST_EMAIL;
	process.env.OPENAI_API_KEY = "sk-test-stub";
});

beforeEach(async () => {
	storage = createInMemoryStorage();
	_setStorageForTests(storage);
	if (SHOULD_RUN) {
		await _resetRecipientDataForTests();
	}
});

afterEach(() => {
	globalThis.fetch = realFetch;
	_setStorageForTests(null);
});

dscribe("GET /r/:token envelope", () => {
	it("returns giver, recipient, prompts, sharing, archived flag", async () => {
		stubWhisper("");
		const { recipient } = await seed();
		const res = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			giver: { recipientName: string };
			recipient: { name: string; email: string; accountCreated: boolean };
			personalMessage: string | null;
			prompts: Array<{ id: string; text: string }>;
			sharing: { mode: string; sharedAt: string | null };
			archived: boolean;
		};
		expect(body.giver.recipientName).toBe("Mom");
		expect(body.recipient.name).toBe("Mom");
		expect(body.recipient.accountCreated).toBe(false);
		expect(body.personalMessage).toContain("I made you something");
		expect(body.prompts).toHaveLength(3);
		expect(body.sharing.mode).toBe("when-ready");
		expect(body.sharing.sharedAt).toBeNull();
		expect(body.archived).toBe(false);
	});
});

dscribe("GET /r/:token/prompts", () => {
	it("returns prompts shaped from the giver's questions", async () => {
		const { recipient, q1 } = await seed();
		const res = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/prompts`),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			prompts: Array<{ id: string; text: string; preface: string | null }>;
		};
		expect(body.prompts.find((p) => p.id === q1.id)?.text).toBe(
			"What was your favorite room growing up?",
		);
	});
});

dscribe("Journal entries CRUD", () => {
	it("creates a free-write entry and lists it", async () => {
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					source: "free-write",
					text: "the morning light through the kitchen window",
				}),
			}),
		);
		expect(post.status).toBe(200);
		const { entry } = (await post.json()) as {
			entry: { id: string; source: string; text: string };
		};
		expect(entry.source).toBe("free-write");
		expect(entry.text).toBe("the morning light through the kitchen window");

		const list = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`),
		);
		const { entries } = (await list.json()) as {
			entries: Array<{ id: string }>;
		};
		expect(entries).toHaveLength(1);
		expect(entries[0].id).toBe(entry.id);
	});

	it("snapshots promptText from the giver question on prompt entries", async () => {
		const { recipient, q1 } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					source: "prompt",
					promptId: q1.id,
					text: "the kitchen",
				}),
			}),
		);
		const { entry } = (await post.json()) as {
			entry: { promptId: string | null; promptText: string | null };
		};
		expect(entry.promptId).toBe(q1.id);
		expect(entry.promptText).toBe("What was your favorite room growing up?");
	});

	it("PATCH updates text", async () => {
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "first draft" }),
			}),
		);
		const { entry } = (await post.json()) as { entry: { id: string } };
		const patch = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/entries/${entry.id}`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "second draft, more honest" }),
				},
			),
		);
		expect(patch.status).toBe(200);
		const { entry: updated } = (await patch.json()) as {
			entry: { text: string };
		};
		expect(updated.text).toBe("second draft, more honest");
	});

	it("DELETE removes the entry", async () => {
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "delete me" }),
			}),
		);
		const { entry } = (await post.json()) as { entry: { id: string } };
		const del = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/entries/${entry.id}`,
				{ method: "DELETE" },
			),
		);
		expect(del.status).toBe(200);
		const list = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`),
		);
		const { entries } = (await list.json()) as { entries: Array<unknown> };
		expect(entries).toHaveLength(0);
	});
});

dscribe("Entry photo + audio uploads", () => {
	it("uploads a photo to a photo entry", async () => {
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "photo", text: "june 4th, sunny" }),
			}),
		);
		const { entry } = (await post.json()) as { entry: { id: string } };
		const fd = new FormData();
		fd.append(
			"photo",
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "wedding.png", {
				type: "image/png",
			}),
		);
		const upload = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/entries/${entry.id}/photo`,
				{ method: "POST", body: fd },
			),
		);
		expect(upload.status).toBe(200);
		const { entry: updated, photoUrl } = (await upload.json()) as {
			entry: { photoUrl: string | null };
			photoUrl: string;
		};
		expect(photoUrl).toMatch(/r-photos\/.*\.png$/);
		expect(updated.photoUrl).toBe(photoUrl);
		expect(storage._dump().some((d) => d.key.startsWith("r-photos/"))).toBe(
			true,
		);
	});

	it("uploads audio + transcribes + stores duration", async () => {
		stubWhisper("the sound of the rain on the kitchen window");
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "voice" }),
			}),
		);
		const { entry } = (await post.json()) as { entry: { id: string } };
		const fd = new FormData();
		fd.append(
			"audio",
			new File([new Uint8Array([1, 2, 3, 4])], "note.wav", {
				type: "audio/wav",
			}),
		);
		fd.append("durationSeconds", "42");
		const upload = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/entries/${entry.id}/audio`,
				{ method: "POST", body: fd },
			),
		);
		expect(upload.status).toBe(200);
		const body = (await upload.json()) as {
			audioUrl: string;
			transcript: string;
			durationSeconds: number | null;
			entry: {
				audioUrl: string | null;
				text: string | null;
				durationSeconds: number | null;
			};
		};
		expect(body.audioUrl).toMatch(/r-audio\//);
		expect(body.transcript).toBe(
			"the sound of the rain on the kitchen window",
		);
		expect(body.durationSeconds).toBe(42);
		expect(body.entry.text).toBe(body.transcript);
	});

	it("audio upload still saves audio when Whisper fails", async () => {
		stubWhisper("", { fail: true });
		const { recipient } = await seed();
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "voice", text: "fallback text" }),
			}),
		);
		const { entry } = (await post.json()) as { entry: { id: string } };
		const fd = new FormData();
		fd.append(
			"audio",
			new File([new Uint8Array([7])], "x.wav", { type: "audio/wav" }),
		);
		const upload = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/entries/${entry.id}/audio`,
				{ method: "POST", body: fd },
			),
		);
		expect(upload.status).toBe(200);
		const body = (await upload.json()) as {
			audioUrl: string;
			transcript: string;
			entry: { audioUrl: string | null; text: string | null };
		};
		expect(body.audioUrl).toMatch(/r-audio\//);
		// Whisper failed → preserves existing text on the entry instead
		// of overwriting with an empty transcript.
		expect(body.transcript).toBe("fallback text");
		expect(body.entry.text).toBe("fallback text");
	});
});

dscribe("Sharing", () => {
	it("PATCH /sharing updates mode + date", async () => {
		const { recipient } = await seed();
		const res = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/sharing`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: "date", date: "2027-06-04" }),
			}),
		);
		expect(res.status).toBe(200);
		const { sharing } = (await res.json()) as {
			sharing: { mode: string; date: string | null };
		};
		expect(sharing.mode).toBe("date");
		expect(sharing.date).toBe("2027-06-04");
	});

	it("POST /share is one-time + idempotent", async () => {
		const { recipient } = await seed();

		// Pre-share a couple of entries so snapshot count is meaningful.
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "one" }),
			}),
		);
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "two" }),
			}),
		);

		const first = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/share`, {
				method: "POST",
			}),
		);
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as {
			sharing: {
				sharedAt: string | null;
				lastSharedSnapshotCount: number | null;
			};
			alreadyShared: boolean;
		};
		expect(firstBody.alreadyShared).toBe(false);
		expect(firstBody.sharing.sharedAt).not.toBeNull();
		expect(firstBody.sharing.lastSharedSnapshotCount).toBe(2);

		const second = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/share`, {
				method: "POST",
			}),
		);
		const secondBody = (await second.json()) as {
			alreadyShared: boolean;
			sharing: { sharedAt: string | null };
		};
		expect(secondBody.alreadyShared).toBe(true);
		// sharedAt is stable on the second call (snapshot frozen).
		expect(secondBody.sharing.sharedAt).toBe(firstBody.sharing.sharedAt);
	});

	it("write endpoints return 409 once sharing is locked", async () => {
		const { recipient } = await seed();
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/share`, {
				method: "POST",
			}),
		);
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/entries`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "too late" }),
			}),
		);
		expect(post.status).toBe(409);
	});

	it("PATCH /sharing is also locked after share", async () => {
		const { recipient } = await seed();
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/share`, {
				method: "POST",
			}),
		);
		const patch = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/sharing`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: "date", date: "2030-01-01" }),
			}),
		);
		expect(patch.status).toBe(409);
	});

	it("envelope reflects archived state after share", async () => {
		const { recipient } = await seed();
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/share`, {
				method: "POST",
			}),
		);
		const env = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		);
		const body = (await env.json()) as { archived: boolean };
		expect(body.archived).toBe(true);
	});
});

dscribe("Recipient account + login", () => {
	it("POST /r/:token/account sets credentials + envelope flips accountCreated", async () => {
		const { recipient } = await seed();
		const email = procEmail("mom-login-a");
		const post = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/account`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: email.toUpperCase(),
					password: "the-radio-was-on",
				}),
			}),
		);
		expect(post.status).toBe(200);
		const body = (await post.json()) as {
			recipient: { email: string; accountCreated: boolean };
		};
		// Email is normalized.
		expect(body.recipient.email).toBe(email);
		expect(body.recipient.accountCreated).toBe(true);

		const env = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		);
		const envBody = (await env.json()) as {
			recipient: { accountCreated: boolean };
		};
		expect(envBody.recipient.accountCreated).toBe(true);
	});

	it("POST /auth/recipient/login returns the access token + redirect", async () => {
		const { recipient } = await seed();
		const email = procEmail("mom-login-b");
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/account`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email,
					password: "the-radio-was-on",
				}),
			}),
		);
		const login = await buildApp().handle(
			new Request("http://localhost/auth/recipient/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email,
					password: "the-radio-was-on",
				}),
			}),
		);
		expect(login.status).toBe(200);
		const body = (await login.json()) as {
			token: string;
			redirectTo: string;
		};
		expect(body.token).toBe(recipient.accessToken);
		expect(body.redirectTo).toBe(`/r/${recipient.accessToken}/journal`);
	});

	it("POST /auth/recipient/login rejects wrong password", async () => {
		const { recipient } = await seed();
		const email = procEmail("mom-login-c");
		await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}/account`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email,
					password: "right-password",
				}),
			}),
		);
		const login = await buildApp().handle(
			new Request("http://localhost/auth/recipient/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email,
					password: "wrong-password",
				}),
			}),
		);
		expect(login.status).toBe(401);
	});

	it("POST /auth/recipient/login rejects unknown email", async () => {
		const login = await buildApp().handle(
			new Request("http://localhost/auth/recipient/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: procEmail("nobody"),
					password: "anything",
				}),
			}),
		);
		expect(login.status).toBe(401);
	});
});

dscribe("Bad token handling", () => {
	it("entries POST returns 404 for unknown token", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/r/bogus/entries", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source: "free-write", text: "ignored" }),
			}),
		);
		expect(res.status).toBe(404);
	});

	it("sharing GET returns 404 for unknown token", async () => {
		const res = await buildApp().handle(
			new Request("http://localhost/r/bogus/sharing"),
		);
		expect(res.status).toBe(404);
	});
});
