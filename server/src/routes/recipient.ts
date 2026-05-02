import { Elysia, t } from "elysia";
import {
	createAudioResponse,
	createPhotoResponse,
	createTextResponse,
	getGiftById,
	getQuestion,
	getRecipientByToken,
	listQuestions,
	listResponses,
	listResponsesForGift,
} from "../lib/gift-store";
import { getPhotoStorage } from "../lib/photo-storage";

const errorSchema = t.Object({ error: t.String() });

const giverSchema = t.Object({
	about: t.Union([t.String(), t.Null()]),
	why: t.Union([t.String(), t.Null()]),
	intent: t.String(),
});

const questionSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	source: t.Union([t.Literal("library"), t.Literal("custom")]),
	templateId: t.Union([t.String(), t.Null()]),
	text: t.String(),
	preface: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
	position: t.Number(),
	createdAt: t.String(),
});

const responseSchema = t.Object({
	id: t.String(),
	questionId: t.String(),
	recipientId: t.String(),
	kind: t.Union([t.Literal("text"), t.Literal("audio"), t.Literal("photo")]),
	text: t.Union([t.String(), t.Null()]),
	audioUrl: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
	caption: t.Union([t.String(), t.Null()]),
	transcript: t.Union([t.String(), t.Null()]),
	createdAt: t.String(),
});

// Public token-scoped routes. No login — the URL token IS the auth, single
// recipient per gift. We collapse "bad token" and "not found" to 404 so
// guessing tokens leaks nothing.
export const recipientRoutes = new Elysia({ prefix: "/r" })
	.get(
		"/:token",
		async ({ params, set }) => {
			const recipient = await getRecipientByToken(params.token);
			if (!recipient) {
				set.status = 404;
				return { error: "Not found" };
			}
			const gift = await getGiftById(recipient.giftId);
			if (!gift) {
				set.status = 404;
				return { error: "Not found" };
			}
			const [questions, responses] = await Promise.all([
				listQuestions(gift.id),
				listResponsesForGift(gift.id),
			]);
			return {
				giver: { about: gift.about, why: gift.why, intent: gift.intent },
				questions,
				responses,
				recipient: {
					name: recipient.name,
					email: recipient.email,
				},
			};
		},
		{
			response: {
				200: t.Object({
					giver: giverSchema,
					questions: t.Array(questionSchema),
					responses: t.Array(responseSchema),
					recipient: t.Object({
						name: t.Union([t.String(), t.Null()]),
						email: t.Union([t.String(), t.Null()]),
					}),
				}),
				404: errorSchema,
			},
			detail: { summary: "Recipient view of gift", tags: ["Recipient"] },
		},
	)
	.get(
		"/:token/questions/:qid",
		async ({ params, set }) => {
			const recipient = await getRecipientByToken(params.token);
			if (!recipient) {
				set.status = 404;
				return { error: "Not found" };
			}
			const question = await getQuestion(params.qid, recipient.giftId);
			if (!question) {
				set.status = 404;
				return { error: "Not found" };
			}
			const responses = await listResponses(question.id);
			return { question, responses };
		},
		{
			response: {
				200: t.Object({
					question: questionSchema,
					responses: t.Array(responseSchema),
				}),
				404: errorSchema,
			},
			detail: { summary: "Question detail with responses", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/text",
		async ({ params, body, set }) => {
			const recipient = await getRecipientByToken(params.token);
			if (!recipient) {
				set.status = 404;
				return { error: "Not found" };
			}
			const question = await getQuestion(params.qid, recipient.giftId);
			if (!question) {
				set.status = 404;
				return { error: "Not found" };
			}
			const response = await createTextResponse(
				question.id,
				recipient.id,
				body.text,
			);
			return { response };
		},
		{
			body: t.Object({ text: t.String({ minLength: 1, maxLength: 10000 }) }),
			response: {
				200: t.Object({ response: responseSchema }),
				404: errorSchema,
			},
			detail: { summary: "Submit a text response", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/voice",
		async ({ params, body, set }) => {
			const recipient = await getRecipientByToken(params.token);
			if (!recipient) {
				set.status = 404;
				return { error: "Not found" };
			}
			const question = await getQuestion(params.qid, recipient.giftId);
			if (!question) {
				set.status = 404;
				return { error: "Not found" };
			}
			const file = body.audio;
			if (!(file instanceof File)) {
				set.status = 400;
				return { error: "Expected multipart 'audio' field" };
			}
			// Whisper itself caps at 25MB; reject earlier rather than upload + fail.
			if (file.size > 25 * 1024 * 1024) {
				set.status = 413;
				return { error: "Audio must be under 25MB" };
			}
			const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
			const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
			const key = `r-audio/${recipient.giftId}/${question.id}/${crypto.randomUUID()}.${safeExt}`;
			const storage = getPhotoStorage();
			const { url } = await storage.put(key, file);
			const transcript = await transcribeAudio(file).catch((err) => {
				console.error("[recipient] transcript failed:", err);
				return null;
			});
			const response = await createAudioResponse(
				question.id,
				recipient.id,
				url,
				transcript,
			);
			return { response };
		},
		{
			body: t.Object({ audio: t.File() }),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
				413: errorSchema,
			},
			detail: { summary: "Submit a voice response", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/questions/:qid/photo",
		async ({ params, body, set }) => {
			const recipient = await getRecipientByToken(params.token);
			if (!recipient) {
				set.status = 404;
				return { error: "Not found" };
			}
			const question = await getQuestion(params.qid, recipient.giftId);
			if (!question) {
				set.status = 404;
				return { error: "Not found" };
			}
			const file = body.photo;
			if (!(file instanceof File)) {
				set.status = 400;
				return { error: "Expected multipart 'photo' field" };
			}
			if (!file.type.startsWith("image/")) {
				set.status = 400;
				return { error: "Photo must be an image" };
			}
			if (file.size > 10 * 1024 * 1024) {
				set.status = 413;
				return { error: "Photo must be under 10MB" };
			}
			const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
			const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
			const key = `r-photos/${recipient.giftId}/${question.id}/${crypto.randomUUID()}.${safeExt}`;
			const storage = getPhotoStorage();
			const { url } = await storage.put(key, file);
			const response = await createPhotoResponse(
				question.id,
				recipient.id,
				url,
				body.caption ?? null,
			);
			return { response };
		},
		{
			body: t.Object({
				photo: t.File(),
				caption: t.Optional(t.String({ maxLength: 500 })),
			}),
			response: {
				200: t.Object({ response: responseSchema }),
				400: errorSchema,
				404: errorSchema,
				413: errorSchema,
			},
			detail: { summary: "Submit a photo response", tags: ["Recipient"] },
		},
	);

// Whisper roundtrip extracted so the voice endpoint stays linear. Returns
// null on missing API key — the audio still uploads, transcript backfills
// can run later.
async function transcribeAudio(file: File): Promise<string | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	const fd = new FormData();
	fd.append("file", file, file.name || "audio.bin");
	fd.append("model", "whisper-1");
	const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}` },
		body: fd,
	});
	if (!res.ok) {
		console.error("[whisper]", res.status, await res.text());
		return null;
	}
	const data = (await res.json()) as { text?: string };
	return data.text ?? null;
}

