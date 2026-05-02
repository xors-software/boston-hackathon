import { Elysia, t } from "elysia";
import {
	deleteResponse,
	listQuestions,
	listResponses,
	listResponsesForQuestion,
	loadByToken,
	saveResponse,
	touchRecipient,
} from "../lib/gift-store";
import {
	errorSchema,
	questionSchema,
	responseSchema,
} from "../lib/route-helpers";
import { bucketFor, getStorage, keyFor } from "../lib/storage";
import {
	extFromMime,
	TranscribeError,
	transcribeAudio,
} from "../lib/transcribe";

const giverSchema = t.Object({
	recipientName: t.String(),
});

function extFromImageMime(mime: string | undefined): string {
	if (!mime) return "bin";
	if (mime.includes("png")) return "png";
	if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
	if (mime.includes("webp")) return "webp";
	if (mime.includes("gif")) return "gif";
	if (mime.includes("heic")) return "heic";
	return "bin";
}

export const recipientRoutes = new Elysia({ prefix: "/r" })
	.get(
		"/:token",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const [, questions, responses] = await Promise.all([
				touchRecipient(params.token),
				listQuestions(found.gift.id),
				listResponses(found.gift.id),
			]);
			return {
				giver: { recipientName: found.gift.recipientName },
				questions,
				responses,
			};
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({
					giver: giverSchema,
					questions: t.Array(questionSchema),
					responses: t.Array(responseSchema),
				}),
				404: errorSchema,
			},
			detail: {
				summary: "Recipient view of a gift (token auth)",
				tags: ["Recipient"],
			},
		},
	)
	.get(
		"/:token/questions/:qid",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const [, questions, responses] = await Promise.all([
				touchRecipient(params.token),
				listQuestions(found.gift.id),
				listResponsesForQuestion(found.gift.id, params.qid),
			]);
			const q = questions.find((x) => x.id === params.qid);
			if (!q) {
				set.status = 404;
				return { error: "Question not found" };
			}
			return { question: q, responses };
		},
		{
			params: t.Object({ token: t.String(), qid: t.String() }),
			response: {
				200: t.Object({
					question: questionSchema,
					responses: t.Array(responseSchema),
				}),
				404: errorSchema,
			},
			detail: { summary: "Single question + saved responses", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/text",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const questions = await listQuestions(found.gift.id);
			const q = questions.find((x) => x.id === params.qid);
			if (!q) {
				set.status = 404;
				return { error: "Question not found" };
			}
			const [response] = await Promise.all([
				saveResponse({
					giftId: found.gift.id,
					recipientId: found.recipient.id,
					questionId: q.id,
					kind: "text",
					text: body.text,
				}),
				touchRecipient(params.token),
			]);
			return { response };
		},
		{
			params: t.Object({ token: t.String(), qid: t.String() }),
			body: t.Object({ text: t.String({ minLength: 1, maxLength: 8000 }) }),
			response: {
				200: t.Object({ response: responseSchema }),
				404: errorSchema,
			},
			detail: { summary: "Save a text answer", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/voice",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const questions = await listQuestions(found.gift.id);
			const q = questions.find((x) => x.id === params.qid);
			if (!q) {
				set.status = 404;
				return { error: "Question not found" };
			}
			const file = body.audio as File;
			if (!file || file.size === 0) {
				set.status = 400;
				return { error: "No audio file provided" };
			}

			// 1. Persist raw audio. Audio stays raw — see BACKEND_HANDOFF §6:
			// the voice in the parent's voice is the product.
			const ext = extFromMime(file.type);
			const storage = await getStorage();
			const buf = await file.arrayBuffer();
			const put = await storage.put({
				bucket: bucketFor("r-audio"),
				key: keyFor("r-audio", {
					giftId: found.gift.id,
					questionId: q.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "audio/webm",
			});

			// 2. Transcribe (Whisper). Failure shouldn't drop the audio —
			// the recipient already submitted, the transcript is a
			// nice-to-have for preview/search/accessibility.
			let transcript = "";
			try {
				const filename = file.name || `audio.${ext}`;
				const result = await transcribeAudio(file, filename);
				transcript = result.text;
			} catch (err) {
				if (err instanceof TranscribeError) {
					console.error(
						"[recipient/voice] transcribe failed:",
						err.status,
						err.detail ?? err.message,
					);
				} else {
					console.error("[recipient/voice] transcribe error:", err);
				}
			}

			const [response] = await Promise.all([
				saveResponse({
					giftId: found.gift.id,
					recipientId: found.recipient.id,
					questionId: q.id,
					kind: "voice",
					text: transcript || null,
					audioUrl: put.url,
				}),
				touchRecipient(params.token),
			]);
			return { response };
		},
		{
			params: t.Object({ token: t.String(), qid: t.String() }),
			body: t.Object({ audio: t.File({ maxSize: "25m" }) }),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Save a voice answer", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/photo",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const questions = await listQuestions(found.gift.id);
			const q = questions.find((x) => x.id === params.qid);
			if (!q) {
				set.status = 404;
				return { error: "Question not found" };
			}
			const file = body.photo as File;
			if (!file || file.size === 0) {
				set.status = 400;
				return { error: "No photo file provided" };
			}

			const ext = extFromImageMime(file.type);
			const storage = await getStorage();
			const buf = await file.arrayBuffer();
			const put = await storage.put({
				bucket: bucketFor("r-photos"),
				key: keyFor("r-photos", {
					giftId: found.gift.id,
					questionId: q.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "application/octet-stream",
			});

			const caption =
				typeof body.caption === "string" && body.caption.length > 0
					? body.caption
					: null;

			const [response] = await Promise.all([
				saveResponse({
					giftId: found.gift.id,
					recipientId: found.recipient.id,
					questionId: q.id,
					kind: "photo",
					text: caption,
					photoUrl: put.url,
				}),
				touchRecipient(params.token),
			]);
			return { response };
		},
		{
			params: t.Object({ token: t.String(), qid: t.String() }),
			body: t.Object({
				photo: t.File({ maxSize: "10m" }),
				caption: t.Optional(t.String({ maxLength: 2000 })),
			}),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Save a photo answer", tags: ["Recipient"] },
		},
	)
	.delete(
		"/:token/responses/:rid",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const [ok] = await Promise.all([
				deleteResponse(found.gift.id, params.rid),
				touchRecipient(params.token),
			]);
			if (!ok) {
				set.status = 404;
				return { error: "Response not found" };
			}
			return { ok: true as const };
		},
		{
			params: t.Object({ token: t.String(), rid: t.String() }),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				404: errorSchema,
			},
			detail: { summary: "Delete a response", tags: ["Recipient"] },
		},
	);
