import { Elysia, t } from "elysia";
import { sendInvitation } from "../lib/email";
import {
	addPerson,
	addQuestion,
	createGift,
	deleteGift,
	deletePerson,
	deleteQuestion,
	getRecipientForGift,
	listGiftsForUser,
	listPeople,
	listQuestions,
	listResponses,
	patchGift,
	patchPerson,
	patchQuestion,
	replacePeople,
	sendGift,
	SendValidationError,
	setQuestionPhoto,
} from "../lib/gift-store";
import { findTemplate } from "../lib/question-templates";
import {
	errorSchema,
	isFail,
	loadGift,
	questionSchema,
	requireUser,
	responseSchema,
} from "../lib/route-helpers";
import { bucketFor, getStorage, keyFor } from "../lib/storage";
import { type AppUser, authContext } from "../lib/xors-identity";

// Cap matches recipient photo route. Bigger than 10MB usually means a misclick;
// fail fast rather than burn bandwidth + bucket on something we'd reject anyway.
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
function extFromImageMime(mime: string): string {
	if (mime.includes("png")) return "png";
	if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
	if (mime.includes("webp")) return "webp";
	if (mime.includes("gif")) return "gif";
	if (mime.includes("heic")) return "heic";
	return "bin";
}

const intentSchema = t.Union([
	t.Literal("mom"),
	t.Literal("dad"),
	t.Literal("loved-one"),
	t.Literal("undecided"),
]);

const deliverySchema = t.Union([t.Literal("email"), t.Literal("in-person")]);
const statusSchema = t.Union([
	t.Literal("draft"),
	t.Literal("sent"),
	t.Literal("archived"),
]);
const stepSchema = t.Union([
	t.Literal("welcome"),
	t.Literal("intent"),
	t.Literal("account"),
	t.Literal("recipient"),
	t.Literal("why"),
	t.Literal("world"),
	t.Literal("questions"),
	t.Literal("delivery"),
	t.Literal("send"),
	t.Literal("complete"),
]);

const giftSchema = t.Object({
	id: t.String(),
	userId: t.String(),
	intent: intentSchema,
	about: t.String(),
	why: t.String(),
	delivery: deliverySchema,
	recipientName: t.String(),
	recipientEmail: t.Union([t.String(), t.Null()]),
	currentStep: stepSchema,
	status: statusSchema,
	sentAt: t.Union([t.String(), t.Null()]),
	timeLockAt: t.Union([t.String(), t.Null()]),
	releasedAt: t.Union([t.String(), t.Null()]),
	createdAt: t.String(),
	updatedAt: t.String(),
});

const personSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	name: t.String(),
	relationship: t.String(),
	age: t.String(),
	description: t.String(),
	position: t.Number(),
});

const recipientSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	accessToken: t.String(),
	email: t.String(),
	name: t.String(),
	firstSeenAt: t.Union([t.String(), t.Null()]),
	lastActiveAt: t.Union([t.String(), t.Null()]),
});

export const giftsRoutes = new Elysia({ prefix: "/gifts" })
	.use(authContext)
	.post(
		"/",
		async (ctx) => {
			const user = requireUser(ctx);
			if (isFail(user)) return { error: user.error };
			const gift = await createGift(user.id, ctx.body.intent);
			return { gift };
		},
		{
			body: t.Object({ intent: t.Optional(intentSchema) }),
			response: {
				200: t.Object({ gift: giftSchema }),
				401: errorSchema,
			},
			detail: { summary: "Create a draft gift", tags: ["Gifts"] },
		},
	)
	.get(
		"/",
		async (ctx) => {
			const user = requireUser(ctx);
			if (isFail(user)) return { error: user.error };
			return { gifts: await listGiftsForUser(user.id) };
		},
		{
			response: {
				200: t.Object({ gifts: t.Array(giftSchema) }),
				401: errorSchema,
			},
			detail: { summary: "List my gifts", tags: ["Gifts"] },
		},
	)
	.get(
		"/:id",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const { gift } = result;
			const [people, questions, recipient, responses] = await Promise.all([
				listPeople(gift.id),
				listQuestions(gift.id),
				getRecipientForGift(gift.id),
				listResponses(gift.id),
			]);
			return { gift, people, questions, recipient, responses };
		},
		{
			params: t.Object({ id: t.String() }),
			response: {
				200: t.Object({
					gift: giftSchema,
					people: t.Array(personSchema),
					questions: t.Array(questionSchema),
					recipient: t.Union([recipientSchema, t.Null()]),
					responses: t.Array(responseSchema),
				}),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Get a gift with nested resources", tags: ["Gifts"] },
		},
	)
	.patch(
		"/:id",
		async (ctx) => {
			const user = requireUser(ctx);
			if (isFail(user)) return { error: user.error };
			const gift = await patchGift(ctx.params.id, user.id, ctx.body);
			if (!gift) {
				ctx.set.status = 404;
				return { error: "Gift not found" };
			}
			return { gift };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				intent: t.Optional(intentSchema),
				about: t.Optional(t.String({ maxLength: 4000 })),
				why: t.Optional(t.String({ maxLength: 4000 })),
				delivery: t.Optional(deliverySchema),
				recipientName: t.Optional(t.String({ maxLength: 200 })),
				recipientEmail: t.Optional(t.Union([t.String({ maxLength: 320 }), t.Null()])),
				currentStep: t.Optional(stepSchema),
				timeLockAt: t.Optional(t.Union([t.String(), t.Null()])),
			}),
			response: {
				200: t.Object({ gift: giftSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Patch gift fields", tags: ["Gifts"] },
		},
	)
	.delete(
		"/:id",
		async (ctx) => {
			const user = requireUser(ctx);
			if (isFail(user)) return { error: user.error };
			const ok = await deleteGift(ctx.params.id, user.id);
			if (!ok) {
				ctx.set.status = 404;
				return { error: "Gift not found" };
			}
			return { ok: true as const };
		},
		{
			params: t.Object({ id: t.String() }),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Delete or archive a gift", tags: ["Gifts"] },
		},
	)
	.get(
		"/:id/people",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			return { people: await listPeople(result.gift.id) };
		},
		{
			params: t.Object({ id: t.String() }),
			response: {
				200: t.Object({ people: t.Array(personSchema) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "List people for a gift", tags: ["People"] },
		},
	)
	.post(
		"/:id/people",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const person = await addPerson(result.gift.id, ctx.body);
			return { person };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				name: t.String({ minLength: 1, maxLength: 200 }),
				relationship: t.String({ minLength: 1, maxLength: 200 }),
				age: t.String({ maxLength: 60 }),
				description: t.String({ maxLength: 1000 }),
			}),
			response: {
				200: t.Object({ person: personSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Add a person", tags: ["People"] },
		},
	)
	.patch(
		"/:id/people/:pid",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const person = await patchPerson(result.gift.id, ctx.params.pid, ctx.body);
			if (!person) {
				ctx.set.status = 404;
				return { error: "Person not found" };
			}
			return { person };
		},
		{
			params: t.Object({ id: t.String(), pid: t.String() }),
			body: t.Object({
				name: t.Optional(t.String({ maxLength: 200 })),
				relationship: t.Optional(t.String({ maxLength: 200 })),
				age: t.Optional(t.String({ maxLength: 60 })),
				description: t.Optional(t.String({ maxLength: 1000 })),
			}),
			response: {
				200: t.Object({ person: personSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Patch a person", tags: ["People"] },
		},
	)
	.delete(
		"/:id/people/:pid",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const ok = await deletePerson(result.gift.id, ctx.params.pid);
			if (!ok) {
				ctx.set.status = 404;
				return { error: "Person not found" };
			}
			return { ok: true as const };
		},
		{
			params: t.Object({ id: t.String(), pid: t.String() }),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Delete a person", tags: ["People"] },
		},
	)
	.put(
		"/:id/people",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const people = await replacePeople(result.gift.id, ctx.body.people);
			return { people };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				people: t.Array(
					t.Object({
						id: t.Optional(t.String()),
						name: t.String({ minLength: 1, maxLength: 200 }),
						relationship: t.String({ minLength: 1, maxLength: 200 }),
						age: t.String({ maxLength: 60 }),
						description: t.String({ maxLength: 1000 }),
					}),
				),
			}),
			response: {
				200: t.Object({ people: t.Array(personSchema) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Replace all people for a gift", tags: ["People"] },
		},
	)
	.get(
		"/:id/questions",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			return { questions: await listQuestions(result.gift.id) };
		},
		{
			params: t.Object({ id: t.String() }),
			response: {
				200: t.Object({ questions: t.Array(questionSchema) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "List questions for a gift", tags: ["Questions"] },
		},
	)
	.post(
		"/:id/questions",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const { gift } = result;
			if (ctx.body.source === "library") {
				const tpl = findTemplate(ctx.body.templateId);
				if (!tpl) {
					ctx.set.status = 404;
					return { error: "Template not found" };
				}
				const q = await addQuestion(gift.id, {
					source: "library",
					templateId: ctx.body.templateId,
					text: ctx.body.text ?? tpl.text,
				});
				return { question: q };
			}
			const q = await addQuestion(gift.id, {
				source: "custom",
				text: ctx.body.text,
				preface: ctx.body.preface,
				photoUrl: ctx.body.photoUrl,
			});
			return { question: q };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Union([
				t.Object({
					source: t.Literal("library"),
					templateId: t.String(),
					text: t.Optional(t.String({ maxLength: 1000 })),
				}),
				t.Object({
					source: t.Literal("custom"),
					text: t.String({ minLength: 1, maxLength: 1000 }),
					preface: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
					photoUrl: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
				}),
			]),
			response: {
				200: t.Object({ question: questionSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Add a question to a gift", tags: ["Questions"] },
		},
	)
	.patch(
		"/:id/questions/:qid",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const q = await patchQuestion(result.gift.id, ctx.params.qid, ctx.body);
			if (!q) {
				ctx.set.status = 404;
				return { error: "Question not found" };
			}
			return { question: q };
		},
		{
			params: t.Object({ id: t.String(), qid: t.String() }),
			body: t.Object({
				text: t.Optional(t.String({ minLength: 1, maxLength: 1000 })),
				preface: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
				position: t.Optional(t.Number({ minimum: 0 })),
			}),
			response: {
				200: t.Object({ question: questionSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Patch a question", tags: ["Questions"] },
		},
	)
	.delete(
		"/:id/questions/:qid",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const ok = await deleteQuestion(result.gift.id, ctx.params.qid);
			if (!ok) {
				ctx.set.status = 404;
				return { error: "Question not found" };
			}
			return { ok: true as const };
		},
		{
			params: t.Object({ id: t.String(), qid: t.String() }),
			response: {
				200: t.Object({ ok: t.Literal(true) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Delete a question", tags: ["Questions"] },
		},
	)
	.post(
		"/:id/questions/:qid/photo",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const file = ctx.body.photo as File;
			if (!file || file.size === 0) {
				ctx.set.status = 400;
				return { error: "No photo file provided" };
			}
			if (!file.type.startsWith("image/")) {
				ctx.set.status = 400;
				return { error: "Photo must be an image" };
			}
			if (file.size > PHOTO_MAX_BYTES) {
				ctx.set.status = 413;
				return { error: "Photo must be under 10MB" };
			}
			const ext = extFromImageMime(file.type);
			const storage = await getStorage();
			const buf = await file.arrayBuffer();
			const put = await storage.put({
				bucket: bucketFor("q-photos"),
				key: keyFor("q-photos", {
					giftId: result.gift.id,
					questionId: ctx.params.qid,
					ext,
				}),
				body: buf,
				contentType: file.type || "application/octet-stream",
			});
			const q = await setQuestionPhoto(
				result.gift.id,
				ctx.params.qid,
				put.url,
			);
			if (!q) {
				ctx.set.status = 404;
				return { error: "Question not found" };
			}
			return { question: q };
		},
		{
			params: t.Object({ id: t.String(), qid: t.String() }),
			body: t.Object({ photo: t.File({ maxSize: "10m" }) }),
			response: {
				200: t.Object({ question: questionSchema }),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
				413: errorSchema,
			},
			detail: { summary: "Upload a question photo (multipart → S3)", tags: ["Questions"] },
		},
	)
	.delete(
		"/:id/questions/:qid/photo",
		async (ctx) => {
			const result = await loadGift(ctx);
			if (isFail(result)) return { error: result.error };
			const q = await setQuestionPhoto(result.gift.id, ctx.params.qid, null);
			if (!q) {
				ctx.set.status = 404;
				return { error: "Question not found" };
			}
			return { question: q };
		},
		{
			params: t.Object({ id: t.String(), qid: t.String() }),
			response: {
				200: t.Object({ question: questionSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Remove a question's photo", tags: ["Questions"] },
		},
	)
	.post(
		"/:id/send",
		async (ctx) => {
			const user = requireUser(ctx);
			if (isFail(user)) return { error: user.error };
			try {
				const result = await sendGift(ctx.params.id, user.id);
				// Fire the invitation on every successful send (including the
				// `alreadySent` retry path) — gives the giver a way to retry
				// delivery by re-tapping send if the first email failed.
				// Errors are logged but don't surface; the recipient row is
				// already persisted, and rolling back would lose the token.
				if (result.gift.delivery === "email" && result.recipient.email) {
					await deliverInvitation(user, result);
				}
				return result;
			} catch (err) {
				if (err instanceof SendValidationError) {
					ctx.set.status = err.field === "gift" ? 404 : 400;
					return { error: err.message };
				}
				console.error("send gift failed:", err);
				ctx.set.status = 500;
				return { error: "Send failed" };
			}
		},
		{
			params: t.Object({ id: t.String() }),
			response: {
				200: t.Object({
					gift: giftSchema,
					recipient: recipientSchema,
					alreadySent: t.Boolean(),
				}),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
				500: errorSchema,
			},
			detail: { summary: "Send a gift to its recipient", tags: ["Gifts"] },
		},
	);

function giverDisplayName(user: AppUser): string {
	if (user.displayName?.trim()) return user.displayName.trim();
	const local = user.email.split("@")[0]?.trim();
	return local || "Someone";
}

async function deliverInvitation(
	user: AppUser,
	result: Awaited<ReturnType<typeof sendGift>>,
): Promise<void> {
	const baseUrl = (process.env.TIME_LOCK_BASE_URL ?? "https://ember.app").replace(
		/\/$/,
		"",
	);
	const link = `${baseUrl}/r/${result.recipient.accessToken}`;
	try {
		await sendInvitation({
			recipientEmail: result.recipient.email,
			recipientName: result.recipient.name,
			giverName: giverDisplayName(user),
			link,
		});
	} catch (err) {
		console.error(
			`[email] invitation failed for gift=${result.gift.id} recipient=${result.recipient.email}:`,
			err instanceof Error ? err.message : err,
		);
	}
}
