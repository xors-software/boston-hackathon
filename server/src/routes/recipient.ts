import { Elysia, t } from "elysia";
import {
	createEntry,
	deleteEntry,
	deleteResponse,
	type EntrySource,
	getEntry,
	getSharing,
	isJournalArchived,
	listEntries,
	listQuestions,
	listResponses,
	listResponsesForQuestion,
	loadByToken,
	patchEntry,
	patchSharing,
	performShare,
	type Question,
	recipientHasAccount,
	saveResponse,
	setRecipientCredentials,
	SharingLockedError,
	touchRecipient,
} from "../lib/gift-store";
import {
	errorSchema,
	journalEntrySchema,
	parentPromptSchema,
	questionSchema,
	responseSchema,
	sharingStateSchema,
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

const tokenEnvelopeSchema = t.Object({
	giver: giverSchema,
	recipient: t.Object({
		id: t.String(),
		name: t.String(),
		email: t.String(),
		accountCreated: t.Boolean(),
	}),
	personalMessage: t.Union([t.String(), t.Null()]),
	prompts: t.Array(parentPromptSchema),
	sharing: sharingStateSchema,
	archived: t.Boolean(),
	// Kept for backwards compat with the existing recipient page that
	// reads `questions` + `responses` (legacy per-question flow).
	questions: t.Array(questionSchema),
	responses: t.Array(responseSchema),
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

function questionToPrompt(q: Question): {
	id: string;
	text: string;
	preface: string | null;
	photoUrl: string | null;
} {
	return {
		id: q.id,
		text: q.text,
		preface: q.preface,
		photoUrl: q.photoUrl,
	};
}

export const recipientRoutes = new Elysia({ prefix: "/r" })
	// ---------------------------------------------------------------
	// Token envelope: everything the parent's home/letter/start needs.
	// Returns 404 on bad token, otherwise a single `{ giver, recipient,
	// personalMessage, prompts, sharing, archived, questions, responses }`
	// blob. The legacy `questions` + `responses` keys remain for the
	// per-question flow that pre-existed this branch — the new parent
	// UI consumes `prompts`, `entries`, and `sharing` instead.
	// ---------------------------------------------------------------
	.get(
		"/:token",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const [, questions, responses, sharing] = await Promise.all([
				touchRecipient(params.token),
				listQuestions(found.gift.id),
				listResponses(found.gift.id),
				getSharing(found.recipient.id),
			]);
			return {
				giver: { recipientName: found.gift.recipientName },
				recipient: {
					id: found.recipient.id,
					name: found.recipient.name,
					email: found.recipient.email,
					accountCreated: Boolean(found.recipient.accountCreatedAt),
				},
				personalMessage: found.gift.personalMessage,
				prompts: questions.map(questionToPrompt),
				sharing,
				archived: Boolean(sharing.sharedAt),
				questions,
				responses,
			};
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: tokenEnvelopeSchema,
				404: errorSchema,
			},
			detail: {
				summary: "Recipient envelope (giver, prompts, sharing, archived)",
				tags: ["Recipient"],
			},
		},
	)
	// ---------------------------------------------------------------
	// Parent prompts — same set as the giver's curated questions but
	// shaped for the parent's prompt picker. "Used" is derived
	// client-side by matching JournalEntry.promptId against `id`.
	// ---------------------------------------------------------------
	.get(
		"/:token/prompts",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const questions = await listQuestions(found.gift.id);
			return { prompts: questions.map(questionToPrompt) };
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({ prompts: t.Array(parentPromptSchema) }),
				404: errorSchema,
			},
			detail: {
				summary: "Prompts the giver curated, exposed to the recipient",
				tags: ["Recipient"],
			},
		},
	)
	// ---------------------------------------------------------------
	// Journal entries CRUD (parent flow).
	// ---------------------------------------------------------------
	.get(
		"/:token/entries",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const entries = await listEntries(found.recipient.id);
			return { entries };
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({ entries: t.Array(journalEntrySchema) }),
				404: errorSchema,
			},
			detail: { summary: "List journal entries", tags: ["Recipient"] },
		},
	)
	.get(
		"/:token/entries/:eid",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const entry = await getEntry(found.recipient.id, params.eid);
			if (!entry) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			return { entry };
		},
		{
			params: t.Object({ token: t.String(), eid: t.String() }),
			response: {
				200: t.Object({ entry: journalEntrySchema }),
				404: errorSchema,
			},
			detail: { summary: "Get a journal entry", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/entries",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			if (await isJournalArchived(found.recipient.id)) {
				set.status = 409;
				return { error: "Journal is shared and locked" };
			}

			let promptText = body.promptText ?? null;
			// Snapshot the prompt text at write time so subsequent giver
			// edits don't change what the parent saw when journaling.
			if (body.promptId && !promptText) {
				const questions = await listQuestions(found.gift.id);
				const q = questions.find((x) => x.id === body.promptId);
				if (q) promptText = q.text;
			}

			const entry = await createEntry(found.gift.id, found.recipient.id, {
				source: body.source as EntrySource,
				text: body.text ?? null,
				promptId: body.promptId ?? null,
				promptText,
				preface: body.preface ?? null,
			});
			await touchRecipient(params.token);
			return { entry };
		},
		{
			params: t.Object({ token: t.String() }),
			body: t.Object({
				source: t.Union([
					t.Literal("free-write"),
					t.Literal("prompt"),
					t.Literal("ai"),
					t.Literal("voice"),
					t.Literal("photo"),
				]),
				text: t.Optional(t.String({ maxLength: 16000 })),
				promptId: t.Optional(t.String()),
				promptText: t.Optional(t.String({ maxLength: 2000 })),
				preface: t.Optional(t.String({ maxLength: 2000 })),
			}),
			response: {
				200: t.Object({ entry: journalEntrySchema }),
				404: errorSchema,
				409: errorSchema,
			},
			detail: { summary: "Create a journal entry", tags: ["Recipient"] },
		},
	)
	.patch(
		"/:token/entries/:eid",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			if (await isJournalArchived(found.recipient.id)) {
				set.status = 409;
				return { error: "Journal is shared and locked" };
			}
			const entry = await patchEntry(found.recipient.id, params.eid, body);
			if (!entry) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			return { entry };
		},
		{
			params: t.Object({ token: t.String(), eid: t.String() }),
			body: t.Object({
				text: t.Optional(t.String({ maxLength: 16000 })),
				promptText: t.Optional(t.String({ maxLength: 2000 })),
				preface: t.Optional(t.String({ maxLength: 2000 })),
				durationSeconds: t.Optional(t.Number()),
			}),
			response: {
				200: t.Object({ entry: journalEntrySchema }),
				404: errorSchema,
				409: errorSchema,
			},
			detail: { summary: "Patch a journal entry", tags: ["Recipient"] },
		},
	)
	.delete(
		"/:token/entries/:eid",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			if (await isJournalArchived(found.recipient.id)) {
				set.status = 409;
				return { error: "Journal is shared and locked" };
			}
			const ok = await deleteEntry(found.recipient.id, params.eid);
			if (!ok) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			return { ok: true as const };
		},
		{
			params: t.Object({ token: t.String(), eid: t.String() }),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				404: errorSchema,
				409: errorSchema,
			},
			detail: { summary: "Delete a journal entry", tags: ["Recipient"] },
		},
	)
	.post(
		"/:token/entries/:eid/photo",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			if (await isJournalArchived(found.recipient.id)) {
				set.status = 409;
				return { error: "Journal is shared and locked" };
			}
			const existing = await getEntry(found.recipient.id, params.eid);
			if (!existing) {
				set.status = 404;
				return { error: "Entry not found" };
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
					questionId: existing.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "application/octet-stream",
			});
			const updated = await patchEntry(found.recipient.id, existing.id, {
				photoUrl: put.url,
			});
			await touchRecipient(params.token);
			// patchEntry may return null only if the row was deleted between
			// the load above and this update — extremely unlikely, treat as 404.
			if (!updated) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			return { entry: updated, photoUrl: put.url };
		},
		{
			params: t.Object({ token: t.String(), eid: t.String() }),
			body: t.Object({ photo: t.File({ maxSize: "10m" }) }),
			response: {
				200: t.Object({
					entry: journalEntrySchema,
					photoUrl: t.String(),
				}),
				400: errorSchema,
				404: errorSchema,
				409: errorSchema,
			},
			detail: {
				summary: "Upload a photo for a journal entry",
				tags: ["Recipient"],
			},
		},
	)
	.post(
		"/:token/entries/:eid/audio",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			if (await isJournalArchived(found.recipient.id)) {
				set.status = 409;
				return { error: "Journal is shared and locked" };
			}
			const existing = await getEntry(found.recipient.id, params.eid);
			if (!existing) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			const file = body.audio as File;
			if (!file || file.size === 0) {
				set.status = 400;
				return { error: "No audio file provided" };
			}

			// 1. Persist raw audio first — the voice IS the product
			// (BACKEND_HANDOFF_V2 §6). If transcription later fails, we still
			// have the recording.
			const ext = extFromMime(file.type);
			const storage = await getStorage();
			const buf = await file.arrayBuffer();
			const put = await storage.put({
				bucket: bucketFor("r-audio"),
				key: keyFor("r-audio", {
					giftId: found.gift.id,
					questionId: existing.id,
					ext,
				}),
				body: buf,
				contentType: file.type || "audio/webm",
			});

			// 2. Transcribe — best-effort. The recipient's text field is
			// either the transcript or whatever they had before.
			let transcript = existing.text ?? "";
			try {
				const filename = file.name || `audio.${ext}`;
				const result = await transcribeAudio(file, filename);
				if (result.text) transcript = result.text;
			} catch (err) {
				if (err instanceof TranscribeError) {
					console.error(
						"[recipient/entries/audio] transcribe failed:",
						err.status,
						err.detail ?? err.message,
					);
				} else {
					console.error("[recipient/entries/audio] transcribe error:", err);
				}
			}

			const durationSeconds =
				typeof body.durationSeconds === "number"
					? Math.max(0, Math.round(body.durationSeconds))
					: undefined;

			const updated = await patchEntry(found.recipient.id, existing.id, {
				audioUrl: put.url,
				text: transcript,
				durationSeconds,
			});
			await touchRecipient(params.token);
			if (!updated) {
				set.status = 404;
				return { error: "Entry not found" };
			}
			return {
				entry: updated,
				audioUrl: put.url,
				transcript,
				durationSeconds: updated.durationSeconds ?? null,
			};
		},
		{
			params: t.Object({ token: t.String(), eid: t.String() }),
			// Multipart bodies arrive as strings — t.Numeric() coerces.
			body: t.Object({
				audio: t.File({ maxSize: "25m" }),
				durationSeconds: t.Optional(t.Numeric()),
			}),
			response: {
				200: t.Object({
					entry: journalEntrySchema,
					audioUrl: t.String(),
					transcript: t.String(),
					durationSeconds: t.Union([t.Number(), t.Null()]),
				}),
				400: errorSchema,
				404: errorSchema,
				409: errorSchema,
			},
			detail: {
				summary: "Upload audio for a journal entry (with transcription)",
				tags: ["Recipient"],
			},
		},
	)
	// ---------------------------------------------------------------
	// Sharing config + one-time share trigger.
	// ---------------------------------------------------------------
	.get(
		"/:token/sharing",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const sharing = await getSharing(found.recipient.id);
			return { sharing };
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({ sharing: sharingStateSchema }),
				404: errorSchema,
			},
			detail: { summary: "Read sharing state", tags: ["Recipient"] },
		},
	)
	.patch(
		"/:token/sharing",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			try {
				const sharing = await patchSharing(found.recipient.id, body);
				return { sharing };
			} catch (err) {
				if (err instanceof SharingLockedError) {
					set.status = 409;
					return { error: err.message };
				}
				throw err;
			}
		},
		{
			params: t.Object({ token: t.String() }),
			body: t.Object({
				mode: t.Optional(
					t.Union([
						t.Literal("when-ready"),
						t.Literal("legacy"),
						t.Literal("date"),
						t.Literal("milestone"),
					]),
				),
				date: t.Optional(t.Union([t.String(), t.Null()])),
				milestonePreset: t.Optional(
					t.Union([
						t.Literal("future-birthday"),
						t.Literal("anniversary"),
						t.Literal("in-one-year"),
						t.Literal("custom"),
						t.Null(),
					]),
				),
				milestoneText: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
			}),
			response: {
				200: t.Object({ sharing: sharingStateSchema }),
				404: errorSchema,
				409: errorSchema,
			},
			detail: {
				summary: "Update sharing config (one-time before share)",
				tags: ["Recipient"],
			},
		},
	)
	.post(
		"/:token/share",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const result = await performShare(found.recipient.id);
			return {
				sharing: result.sharing,
				alreadyShared: result.alreadyShared,
			};
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({
					sharing: sharingStateSchema,
					alreadyShared: t.Boolean(),
				}),
				404: errorSchema,
			},
			detail: {
				summary: "Perform the one-time share (idempotent)",
				tags: ["Recipient"],
			},
		},
	)
	// ---------------------------------------------------------------
	// Recipient account creation (called on /r/:token/account).
	// ---------------------------------------------------------------
	.post(
		"/:token/account",
		async ({ params, body, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			const recipient = await setRecipientCredentials(
				params.token,
				body.email,
				body.password,
			);
			if (!recipient) {
				set.status = 500;
				return { error: "Failed to save credentials" };
			}
			return {
				ok: true as const,
				recipient: {
					id: recipient.id,
					name: recipient.name,
					email: recipient.email,
					accountCreated: Boolean(recipient.accountCreatedAt),
				},
			};
		},
		{
			params: t.Object({ token: t.String() }),
			body: t.Object({
				email: t.String({ minLength: 3, maxLength: 320 }),
				password: t.String({ minLength: 6, maxLength: 256 }),
			}),
			response: {
				200: t.Object({
					ok: t.Literal(true),
					recipient: t.Object({
						id: t.String(),
						name: t.String(),
						email: t.String(),
						accountCreated: t.Boolean(),
					}),
				}),
				404: errorSchema,
				500: errorSchema,
			},
			detail: {
				summary: "Set recipient login credentials",
				tags: ["Recipient"],
			},
		},
	)
	.get(
		"/:token/account",
		async ({ params, set }) => {
			const found = await loadByToken(params.token);
			if (!found) {
				set.status = 404;
				return { error: "Invalid or expired link" };
			}
			return {
				accountCreated: await recipientHasAccount(params.token),
				email: found.recipient.email,
			};
		},
		{
			params: t.Object({ token: t.String() }),
			response: {
				200: t.Object({
					accountCreated: t.Boolean(),
					email: t.String(),
				}),
				404: errorSchema,
			},
			detail: {
				summary: "Check if recipient has set up a login",
				tags: ["Recipient"],
			},
		},
	)
	// ---------------------------------------------------------------
	// Legacy per-question response endpoints. These pre-existed this
	// branch and stay in place; the new parent UI uses
	// /entries instead. Keeping them avoids churn for any caller that
	// still hits the /questions/:qid surface.
	// ---------------------------------------------------------------
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
			detail: { summary: "Save a text answer (legacy)", tags: ["Recipient"] },
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
			detail: { summary: "Save a voice answer (legacy)", tags: ["Recipient"] },
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
			detail: { summary: "Save a photo answer (legacy)", tags: ["Recipient"] },
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
			detail: { summary: "Delete a response (legacy)", tags: ["Recipient"] },
		},
	);
