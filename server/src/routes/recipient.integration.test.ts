// Integration test for recipient voice + photo endpoints. Hits the
// real Postgres-backed gift-store, so it requires:
//
//   DATABASE_URL=postgresql://localhost:5432/ember_dev \
//   INTEGRATION=1 bun test src/routes/recipient.integration.test.ts
//
// Skipped without INTEGRATION=1 to keep the default `bun test` run
// from depending on a live DB. Whisper is stubbed via globalThis
// fetch override so the test doesn't need an OpenAI key.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
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

// Per-run synthetic email so reruns don't collide on the recipient
// table's unique access_token (the recipient row gets recreated each
// seed). The auth context resolves the test user via TEST_USER_EMAIL.
const TEST_EMAIL = `recipient-it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

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

async function seed() {
	const xorsUserId = `test-${TEST_EMAIL}`;
	const gift0 = await createGift(xorsUserId, "mom");
	const gift =
		(await patchGift(gift0.id, xorsUserId, {
			recipientName: "Mom",
			recipientEmail: "mom@test.local",
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
	// Skip when not running integration — `process.env` is process-global,
	// so leaving TEST_USER_EMAIL set here would short-circuit
	// authContext.maybeTestUser() in every other test file's request.
	if (!SHOULD_RUN) return;
	process.env.TEST_USER_EMAIL = TEST_EMAIL;
	process.env.OPENAI_API_KEY = "sk-test-stub";
});

beforeEach(() => {
	storage = createInMemoryStorage();
	_setStorageForTests(storage);
});

afterEach(() => {
	globalThis.fetch = realFetch;
	_setStorageForTests(null);
});

dscribe("recipient: token + text", () => {
	it("GET /r/:token returns 404 for unknown tokens", async () => {
		stubWhisper("");
		const res = await buildApp().handle(
			new Request("http://localhost/r/does_not_exist"),
		);
		expect(res.status).toBe(404);
	});

	it("POST /text saves answer; appears in GET /r/:token", async () => {
		stubWhisper("");
		const { recipient, q1 } = await seed();
		const post = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/text`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "the kitchen" }),
				},
			),
		);
		expect(post.status).toBe(200);

		const view = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		);
		expect(view.status).toBe(200);
		const body = (await view.json()) as {
			responses: Array<{ kind: string; text: string | null }>;
		};
		const text = body.responses.find((r) => r.kind === "text");
		expect(text?.text).toBe("the kitchen");
	});
});

dscribe("recipient: voice", () => {
	it("POST /voice uploads audio + transcribes + persists both", async () => {
		stubWhisper("the kitchen, where my mother kept the radio on");
		const { recipient, q1 } = await seed();
		const fd = new FormData();
		fd.append(
			"audio",
			new File([new Uint8Array([1, 2, 3, 4])], "answer.wav", {
				type: "audio/wav",
			}),
		);
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		);
		expect(res.status).toBe(200);
		const { response } = (await res.json()) as {
			response: {
				kind: string;
				audioUrl: string | null;
				text: string | null;
			};
		};
		expect(response.kind).toBe("voice");
		expect(response.text).toBe(
			"the kitchen, where my mother kept the radio on",
		);
		expect(response.audioUrl).toMatch(/r-audio\//);
		expect(storage._dump().some((d) => d.key.startsWith("r-audio/"))).toBe(true);
	});

	it("voice still saves audio even if Whisper fails", async () => {
		stubWhisper("", { fail: true });
		const { recipient, q1 } = await seed();
		const fd = new FormData();
		fd.append(
			"audio",
			new File([new Uint8Array([7, 7, 7])], "x.wav", { type: "audio/wav" }),
		);
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		);
		expect(res.status).toBe(200);
		const { response } = (await res.json()) as {
			response: { audioUrl: string | null; text: string | null };
		};
		expect(response.audioUrl).toMatch(/r-audio\//);
		expect(response.text).toBeNull();
	});

	it("rejects empty audio with 400/422", async () => {
		stubWhisper("");
		const { recipient, q1 } = await seed();
		const fd = new FormData();
		fd.append("audio", new File([], "empty.wav", { type: "audio/wav" }));
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});
});

dscribe("recipient: photo", () => {
	it("POST /photo uploads + persists URL + caption", async () => {
		stubWhisper("");
		const { recipient, q2 } = await seed();
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
		]);
		const fd = new FormData();
		fd.append("photo", new File([png], "wedding.png", { type: "image/png" }));
		fd.append("caption", "june 4th, sunny");
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
				{ method: "POST", body: fd },
			),
		);
		expect(res.status).toBe(200);
		const { response } = (await res.json()) as {
			response: {
				kind: string;
				photoUrl: string | null;
				text: string | null;
			};
		};
		expect(response.kind).toBe("photo");
		expect(response.photoUrl).toMatch(/r-photos\/.*\.png$/);
		expect(response.text).toBe("june 4th, sunny");
	});

	it("photo without caption stores text=null", async () => {
		stubWhisper("");
		const { recipient, q2 } = await seed();
		const fd = new FormData();
		fd.append(
			"photo",
			new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
		);
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
				{ method: "POST", body: fd },
			),
		);
		expect(res.status).toBe(200);
		const { response } = (await res.json()) as {
			response: { text: string | null };
		};
		expect(response.text).toBeNull();
	});
});

dscribe("giver-side round-trip", () => {
	it("GET /gifts/:id returns recipient responses with audio + photo URLs", async () => {
		stubWhisper("hello there");
		const { gift, recipient, q1, q2 } = await seed();
		const app = buildApp();

		// recipient submits voice
		{
			const fd = new FormData();
			fd.append(
				"audio",
				new File([new Uint8Array([1, 2])], "v.wav", { type: "audio/wav" }),
			);
			const r = await app.handle(
				new Request(
					`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
					{ method: "POST", body: fd },
				),
			);
			expect(r.status).toBe(200);
		}
		// recipient submits photo
		{
			const fd = new FormData();
			fd.append(
				"photo",
				new File([new Uint8Array([1])], "p.png", { type: "image/png" }),
			);
			fd.append("caption", "look");
			const r = await app.handle(
				new Request(
					`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
					{ method: "POST", body: fd },
				),
			);
			expect(r.status).toBe(200);
		}

		// giver hits GET /gifts/:id (auth bypass via TEST_USER_EMAIL)
		const giverReq = new Request(`http://localhost/gifts/${gift.id}`);
		const res = await app.handle(giverReq);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			gift: { id: string };
			responses: Array<{
				kind: string;
				audioUrl: string | null;
				photoUrl: string | null;
				text: string | null;
			}>;
		};
		expect(body.gift.id).toBe(gift.id);
		const voice = body.responses.find((r) => r.kind === "voice");
		const photo = body.responses.find((r) => r.kind === "photo");
		if (!voice || !photo) throw new Error("missing voice/photo response");
		expect(voice.audioUrl).toMatch(/r-audio\//);
		expect(voice.text).toBe("hello there");
		expect(photo.photoUrl).toMatch(/r-photos\//);
		expect(photo.text).toBe("look");
	});
});

dscribe("recipient: revoke", () => {
	it("DELETE /r/:token/responses/:rid removes the response", async () => {
		stubWhisper("");
		const { recipient, q1 } = await seed();
		const post = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/text`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "answer" }),
				},
			),
		);
		const { response } = (await post.json()) as { response: { id: string } };

		const del = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/responses/${response.id}`,
				{ method: "DELETE" },
			),
		);
		expect(del.status).toBe(200);

		const view = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		);
		const body = (await view.json()) as { responses: Array<unknown> };
		expect(body.responses).toHaveLength(0);
	});
});
