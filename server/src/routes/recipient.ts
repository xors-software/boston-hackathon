import { Elysia, t } from "elysia"
import {
	deleteResponse,
	getQuestionById,
	getRecipientByToken,
	getResponseById,
	listQuestionsForGift,
	listResponsesForRecipient,
	touchRecipientActivity,
	upsertResponse,
} from "../lib/ember-store"
import { bucketFor, getStorage, keyFor } from "../lib/storage"
import {
	extFromMime,
	TranscribeError,
	transcribeAudio,
} from "../lib/transcribe"

const errorSchema = t.Object({ error: t.String() })

const questionSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	source: t.Union([t.Literal("library"), t.Literal("custom")]),
	templateId: t.Union([t.String(), t.Null()]),
	text: t.String(),
	photoUrl: t.Union([t.String(), t.Null()]),
	preface: t.Union([t.String(), t.Null()]),
	position: t.Number(),
})

const responseSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	recipientId: t.String(),
	questionId: t.String(),
	kind: t.Union([t.Literal("text"), t.Literal("voice"), t.Literal("photo")]),
	text: t.Union([t.String(), t.Null()]),
	audioUrl: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
	recordedAt: t.String(),
})

function extFromImageMime(mime: string | undefined): string {
	if (!mime) return "bin"
	if (mime.includes("png")) return "png"
	if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
	if (mime.includes("webp")) return "webp"
	if (mime.includes("gif")) return "gif"
	if (mime.includes("heic")) return "heic"
	return "bin"
}

export const recipientRoutes = new Elysia({ prefix: "/r" })
	.get(
		"/:token",
		({ params: { token }, set }) => {
			const recipient = getRecipientByToken(token)
			if (!recipient) {
				set.status = 404
				return { error: "Not found" }
			}
			touchRecipientActivity(recipient.id)
			return {
				recipient: {
					id: recipient.id,
					name: recipient.name,
					giftId: recipient.giftId,
				},
				questions: listQuestionsForGift(recipient.giftId).map(
					({ createdAt: _c, ...q }) => q,
				),
				responses: listResponsesForRecipient(recipient.id),
			}
		},
		{
			params: t.Object({ token: t.String({ minLength: 1 }) }),
			response: {
				200: t.Object({
					recipient: t.Object({
						id: t.String(),
						name: t.String(),
						giftId: t.String(),
					}),
					questions: t.Array(questionSchema),
					responses: t.Array(responseSchema),
				}),
				404: errorSchema,
			},
			detail: {
				summary: "Recipient: open the gift letter",
				tags: ["Recipient"],
			},
		},
	)
	.post(
		"/:token/questions/:qid/text",
		({ params: { token, qid }, body, set }) => {
			const recipient = getRecipientByToken(token)
			if (!recipient) {
				set.status = 404
				return { error: "Not found" }
			}
			const question = getQuestionById(qid)
			if (!question || question.giftId !== recipient.giftId) {
				set.status = 404
				return { error: "Question not found" }
			}
			touchRecipientActivity(recipient.id)
			const response = upsertResponse({
				giftId: recipient.giftId,
				recipientId: recipient.id,
				questionId: question.id,
				kind: "text",
				text: body.text,
			})
			return { response }
		},
		{
			params: t.Object({
				token: t.String({ minLength: 1 }),
				qid: t.String({ minLength: 1 }),
			}),
			body: t.Object({ text: t.String({ minLength: 1, maxLength: 20000 }) }),
			response: {
				200: t.Object({ response: responseSchema }),
				404: errorSchema,
			},
			detail: {
				summary: "Recipient: submit a text answer",
				tags: ["Recipient"],
			},
		},
	)
	.post(
		"/:token/questions/:qid/voice",
		async ({ params: { token, qid }, body, set }) => {
			const recipient = getRecipientByToken(token)
			if (!recipient) {
				set.status = 404
				return { error: "Not found" }
			}
			const question = getQuestionById(qid)
			if (!question || question.giftId !== recipient.giftId) {
				set.status = 404
				return { error: "Question not found" }
			}
			const file = body.audio as File
			if (!file || file.size === 0) {
				set.status = 400
				return { error: "No audio file provided" }
			}
			touchRecipientActivity(recipient.id)

			// 1. Persist raw audio. Audio stays raw — see BACKEND_HANDOFF §6.
			const ext = extFromMime(file.type)
			const storage = await getStorage()
			const buf = await file.arrayBuffer()
			const put = await storage.put({
				bucket: bucketFor("r-audio"),
				key: keyFor("r-audio", {
					giftId: recipient.giftId,
					questionId: question.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "audio/webm",
			})

			// 2. Transcribe (Whisper). Failure shouldn't drop the audio —
			// the recipient already submitted, the transcript is a nice-to-have.
			let transcript = ""
			try {
				const filename = file.name || `audio.${ext}`
				const result = await transcribeAudio(file, filename)
				transcript = result.text
			} catch (err) {
				if (err instanceof TranscribeError) {
					console.error(
						"[recipient/voice] transcribe failed:",
						err.status,
						err.detail ?? err.message,
					)
				} else {
					console.error("[recipient/voice] transcribe error:", err)
				}
			}

			const response = upsertResponse({
				giftId: recipient.giftId,
				recipientId: recipient.id,
				questionId: question.id,
				kind: "voice",
				text: transcript || null,
				audioUrl: put.url,
			})
			return { response }
		},
		{
			params: t.Object({
				token: t.String({ minLength: 1 }),
				qid: t.String({ minLength: 1 }),
			}),
			body: t.Object({ audio: t.File({ maxSize: "25m" }) }),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
			},
			detail: {
				summary: "Recipient: submit a voice answer",
				tags: ["Recipient"],
			},
		},
	)
	.post(
		"/:token/questions/:qid/photo",
		async ({ params: { token, qid }, body, set }) => {
			const recipient = getRecipientByToken(token)
			if (!recipient) {
				set.status = 404
				return { error: "Not found" }
			}
			const question = getQuestionById(qid)
			if (!question || question.giftId !== recipient.giftId) {
				set.status = 404
				return { error: "Question not found" }
			}
			const file = body.photo as File
			if (!file || file.size === 0) {
				set.status = 400
				return { error: "No photo file provided" }
			}
			touchRecipientActivity(recipient.id)

			const ext = extFromImageMime(file.type)
			const storage = await getStorage()
			const buf = await file.arrayBuffer()
			const put = await storage.put({
				bucket: bucketFor("r-photos"),
				key: keyFor("r-photos", {
					giftId: recipient.giftId,
					questionId: question.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "application/octet-stream",
			})

			const caption =
				typeof body.caption === "string" && body.caption.length > 0
					? body.caption
					: null

			const response = upsertResponse({
				giftId: recipient.giftId,
				recipientId: recipient.id,
				questionId: question.id,
				kind: "photo",
				text: caption,
				photoUrl: put.url,
			})
			return { response }
		},
		{
			params: t.Object({
				token: t.String({ minLength: 1 }),
				qid: t.String({ minLength: 1 }),
			}),
			body: t.Object({
				photo: t.File({ maxSize: "10m" }),
				caption: t.Optional(t.String({ maxLength: 2000 })),
			}),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
			},
			detail: {
				summary: "Recipient: submit a photo answer",
				tags: ["Recipient"],
			},
		},
	)
	.delete(
		"/:token/responses/:rid",
		({ params: { token, rid }, set }) => {
			const recipient = getRecipientByToken(token)
			if (!recipient) {
				set.status = 404
				return { error: "Not found" }
			}
			const response = getResponseById(rid)
			if (!response || response.recipientId !== recipient.id) {
				set.status = 404
				return { error: "Response not found" }
			}
			touchRecipientActivity(recipient.id)
			deleteResponse(rid)
			set.status = 204
			return ""
		},
		{
			params: t.Object({
				token: t.String({ minLength: 1 }),
				rid: t.String({ minLength: 1 }),
			}),
			detail: {
				summary: "Recipient: revoke an answer",
				tags: ["Recipient"],
			},
		},
	)
