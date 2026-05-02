import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test"
import { Elysia } from "elysia"
import {
	_resetForTests,
	addQuestion,
	createGift,
	createRecipient,
} from "../lib/ember-store"
import { _setStorageForTests, createInMemoryStorage } from "../lib/storage"
import { authRoutes } from "./auth"
import { giftsRoutes } from "./gifts"
import { recipientRoutes } from "./recipient"

function buildApp() {
	return new Elysia()
		.use(authRoutes)
		.use(giftsRoutes)
		.use(recipientRoutes)
}

const realFetch = globalThis.fetch
let lastWhisperFile: { name: string; size: number; type: string } | null = null

function stubWhisper(textToReturn: string) {
	globalThis.fetch = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = typeof input === "string" ? input : input.toString()
		if (url.includes("/api/users/viewer")) {
			const headers = new Headers(init?.headers)
			const key = headers.get("X-API-KEY") ?? ""
			if (key === "alice_key") {
				return new Response(
					JSON.stringify({
						viewer: {
							id: "xors_alice_test",
							email: "alice@x.test",
							username: "Alice",
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				)
			}
			return new Response("unauthorized", { status: 401 })
		}
		if (url.includes("api.openai.com/v1/audio/transcriptions")) {
			const fd = init?.body as FormData
			const f = fd.get("file") as File
			lastWhisperFile = { name: f.name, size: f.size, type: f.type }
			return new Response(JSON.stringify({ text: textToReturn }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		return realFetch(input, init)
	}) as typeof fetch
}

beforeAll(() => {
	process.env.OPENAI_API_KEY = "sk-test-stub"
})

beforeEach(() => {
	_resetForTests()
	_setStorageForTests(createInMemoryStorage())
	lastWhisperFile = null
})

afterEach(() => {
	globalThis.fetch = realFetch
})

afterAll(() => {
	_setStorageForTests(null)
})

async function whoAmI(sessionKey: string): Promise<string> {
	const req = new Request("http://localhost/auth/me")
	req.headers.set("cookie", `xors_session=${sessionKey}`)
	const res = await buildApp().handle(req)
	expect(res.status).toBe(200)
	const body = (await res.json()) as { user: { id: string } }
	return body.user.id
}

async function seed() {
	const userId = await whoAmI("alice_key")
	const gift = createGift({ userId, intent: "mom" })
	gift.recipientName = "Mom"
	gift.recipientEmail = "mom@x.test"
	const q1 = addQuestion({
		giftId: gift.id,
		source: "library",
		templateId: "tpl_ch1",
		text: "What was your favorite room growing up?",
	})
	const q2 = addQuestion({
		giftId: gift.id,
		source: "custom",
		text: "Tell me about your wedding day.",
	})
	const r = createRecipient({
		giftId: gift.id,
		email: gift.recipientEmail,
		name: gift.recipientName,
	})
	return { gift, q1, q2, recipient: r }
}

describe("recipient: token resolution", () => {
	it("GET /r/:token returns 404 for unknown tokens", async () => {
		stubWhisper("")
		const res = await buildApp().handle(
			new Request("http://localhost/r/does_not_exist"),
		)
		expect(res.status).toBe(404)
	})

	it("GET /r/:token returns gift letter + questions", async () => {
		stubWhisper("")
		const { recipient, q1 } = await seed()
		const res = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			recipient: { name: string; giftId: string }
			questions: Array<{ id: string }>
			responses: Array<unknown>
		}
		expect(body.recipient.name).toBe("Mom")
		expect(body.recipient.giftId).toBe(recipient.giftId)
		expect(body.questions.map((q) => q.id)).toContain(q1.id)
		expect(body.responses).toHaveLength(0)
	})
})

describe("recipient: text answers", () => {
	it("POST /text saves the answer and shows up in GET /r/:token", async () => {
		stubWhisper("")
		const { recipient, q1 } = await seed()
		const post = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/text`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "the kitchen" }),
				},
			),
		)
		expect(post.status).toBe(200)
		const { response } = (await post.json()) as { response: { id: string } }
		expect(response.id).toBeDefined()

		const view = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		)
		const body = (await view.json()) as {
			responses: Array<{ kind: string; text: string | null }>
		}
		expect(body.responses).toHaveLength(1)
		expect(body.responses[0].kind).toBe("text")
		expect(body.responses[0].text).toBe("the kitchen")
	})

	it("POST /text on a question from a different gift returns 404", async () => {
		stubWhisper("")
		const a = await seed()
		const b = await seed()
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${a.recipient.accessToken}/questions/${b.q1.id}/text`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "x" }),
				},
			),
		)
		expect(res.status).toBe(404)
	})
})

describe("recipient: voice answers", () => {
	it("POST /voice uploads audio, transcribes, persists both", async () => {
		stubWhisper("the kitchen, where my mother kept the radio on")
		const { recipient, q1 } = await seed()
		const fd = new FormData()
		// Tiny WAV-ish blob (content doesn't matter — Whisper is stubbed).
		const audio = new File([new Uint8Array([1, 2, 3, 4])], "answer.wav", {
			type: "audio/wav",
		})
		fd.append("audio", audio)
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		)
		expect(res.status).toBe(200)
		const { response } = (await res.json()) as {
			response: {
				kind: string
				audioUrl: string | null
				text: string | null
				questionId: string
			}
		}
		expect(response.kind).toBe("voice")
		expect(response.questionId).toBe(q1.id)
		expect(response.text).toBe("the kitchen, where my mother kept the radio on")
		expect(response.audioUrl).toMatch(/r-audio\//)
		expect(lastWhisperFile?.name).toBe("answer.wav")
	})

	it("voice still saves audio even if Whisper fails", async () => {
		stubWhisper("") // seed needs the xors viewer stub to materialize the user
		const { recipient, q1 } = await seed()
		// Then swap to a fetch that fails Whisper but keeps the viewer stub.
		globalThis.fetch = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = typeof input === "string" ? input : input.toString()
			if (url.includes("api.openai.com")) {
				return new Response("upstream error", { status: 500 })
			}
			if (url.includes("/api/users/viewer")) {
				return new Response(
					JSON.stringify({
						viewer: {
							id: "xors_alice_test",
							email: "alice@x.test",
							username: "Alice",
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				)
			}
			return realFetch(input, init)
		}) as typeof fetch

		const fd = new FormData()
		fd.append(
			"audio",
			new File([new Uint8Array([7, 7, 7])], "x.wav", { type: "audio/wav" }),
		)
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		)
		expect(res.status).toBe(200)
		const { response } = (await res.json()) as {
			response: { audioUrl: string | null; text: string | null }
		}
		expect(response.audioUrl).toMatch(/r-audio\//)
		expect(response.text).toBeNull()
	})

	it("rejects empty audio with 400/422", async () => {
		stubWhisper("")
		const { recipient, q1 } = await seed()
		const fd = new FormData()
		fd.append(
			"audio",
			new File([], "empty.wav", { type: "audio/wav" }),
		)
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
				{ method: "POST", body: fd },
			),
		)
		expect(res.status).toBeGreaterThanOrEqual(400)
		expect(res.status).toBeLessThan(500)
	})
})

describe("recipient: photo answers", () => {
	it("POST /photo uploads, persists URL + caption", async () => {
		stubWhisper("")
		const { recipient, q2 } = await seed()
		// Tiny "PNG" (signature only — content isn't validated for upload).
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
		])
		const fd = new FormData()
		fd.append("photo", new File([png], "wedding.png", { type: "image/png" }))
		fd.append("caption", "june 4th, sunny")
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
				{ method: "POST", body: fd },
			),
		)
		expect(res.status).toBe(200)
		const { response } = (await res.json()) as {
			response: {
				kind: string
				photoUrl: string | null
				text: string | null
			}
		}
		expect(response.kind).toBe("photo")
		expect(response.photoUrl).toMatch(/r-photos\/.*\.png$/)
		expect(response.text).toBe("june 4th, sunny")
	})

	it("photo without caption stores text=null", async () => {
		stubWhisper("")
		const { recipient, q2 } = await seed()
		const fd = new FormData()
		fd.append(
			"photo",
			new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
		)
		const res = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
				{ method: "POST", body: fd },
			),
		)
		expect(res.status).toBe(200)
		const { response } = (await res.json()) as {
			response: { text: string | null }
		}
		expect(response.text).toBeNull()
	})
})

describe("giver-side round-trip", () => {
	it("GET /gifts/:id returns recipient responses with audio + photo URLs", async () => {
		stubWhisper("hello there")
		const { gift, recipient, q1, q2 } = await seed()
		const app = buildApp()

		// recipient submits voice
		{
			const fd = new FormData()
			fd.append(
				"audio",
				new File([new Uint8Array([1, 2])], "v.wav", { type: "audio/wav" }),
			)
			const r = await app.handle(
				new Request(
					`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/voice`,
					{ method: "POST", body: fd },
				),
			)
			expect(r.status).toBe(200)
		}
		// recipient submits photo
		{
			const fd = new FormData()
			fd.append(
				"photo",
				new File([new Uint8Array([1])], "p.png", { type: "image/png" }),
			)
			fd.append("caption", "look")
			const r = await app.handle(
				new Request(
					`http://localhost/r/${recipient.accessToken}/questions/${q2.id}/photo`,
					{ method: "POST", body: fd },
				),
			)
			expect(r.status).toBe(200)
		}

		// giver hits GET /gifts/:id
		const giverReq = new Request(`http://localhost/gifts/${gift.id}`)
		giverReq.headers.set("cookie", "xors_session=alice_key")
		const res = await app.handle(giverReq)
		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			gift: { id: string }
			questions: Array<{ id: string }>
			responses: Array<{
				kind: string
				audioUrl: string | null
				photoUrl: string | null
				text: string | null
			}>
		}
		expect(body.gift.id).toBe(gift.id)
		expect(body.questions).toHaveLength(2)
		expect(body.responses).toHaveLength(2)
		const voice = body.responses.find((r) => r.kind === "voice")
		const photo = body.responses.find((r) => r.kind === "photo")
		if (!voice || !photo) throw new Error("missing voice/photo response")
		expect(voice.audioUrl).toMatch(/r-audio\//)
		expect(voice.text).toBe("hello there")
		expect(photo.photoUrl).toMatch(/r-photos\//)
		expect(photo.text).toBe("look")
	})

	it("GET /gifts/:id is 404 for a different user's gift", async () => {
		stubWhisper("")
		const { gift } = await seed()
		// "alice_key" maps to xors_alice_test. Use a different key — bob —
		// with a viewer that has a different xorsUserId.
		globalThis.fetch = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = typeof input === "string" ? input : input.toString()
			if (url.includes("/api/users/viewer")) {
				const key = new Headers(init?.headers).get("X-API-KEY") ?? ""
				if (key === "bob_key") {
					return new Response(
						JSON.stringify({
							viewer: {
								id: "xors_bob_test",
								email: "bob@x.test",
								username: "Bob",
							},
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					)
				}
			}
			return new Response("unauthorized", { status: 401 })
		}) as typeof fetch

		const req = new Request(`http://localhost/gifts/${gift.id}`)
		req.headers.set("cookie", "xors_session=bob_key")
		const res = await buildApp().handle(req)
		expect(res.status).toBe(404)
	})

	it("GET /gifts/:id is 401 unauthenticated", async () => {
		stubWhisper("")
		const { gift } = await seed()
		const res = await buildApp().handle(
			new Request(`http://localhost/gifts/${gift.id}`),
		)
		expect(res.status).toBe(401)
	})
})

describe("recipient: revoke", () => {
	it("DELETE /r/:token/responses/:rid removes the response", async () => {
		stubWhisper("")
		const { recipient, q1 } = await seed()
		const post = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/questions/${q1.id}/text`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ text: "answer" }),
				},
			),
		)
		const { response } = (await post.json()) as { response: { id: string } }

		const del = await buildApp().handle(
			new Request(
				`http://localhost/r/${recipient.accessToken}/responses/${response.id}`,
				{ method: "DELETE" },
			),
		)
		expect(del.status).toBe(204)

		const view = await buildApp().handle(
			new Request(`http://localhost/r/${recipient.accessToken}`),
		)
		const body = (await view.json()) as { responses: Array<unknown> }
		expect(body.responses).toHaveLength(0)
	})
})
