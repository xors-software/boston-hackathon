import { Elysia, t } from "elysia";
import {
	createGift,
	createQuestion,
	getGift,
	getQuestion,
	getRecipientByGift,
	listGifts,
	listPeople,
	listQuestions,
	listResponsesForGift,
	patchGift,
	patchQuestion,
	replacePeople,
	sendGift,
	setQuestionPhotoUrl,
} from "../lib/gift-store";
import { getPhotoStorage } from "../lib/photo-storage";
import { authContext } from "../lib/xors-identity";

const errorSchema = t.Object({ error: t.String() });

const giftSchema = t.Object({
	id: t.String(),
	userId: t.String(),
	intent: t.String(),
	about: t.Union([t.String(), t.Null()]),
	why: t.Union([t.String(), t.Null()]),
	recipientName: t.Union([t.String(), t.Null()]),
	recipientEmail: t.Union([t.String(), t.Null()]),
	delivery: t.Union([t.String(), t.Null()]),
	currentStep: t.Union([t.String(), t.Null()]),
	status: t.Union([t.Literal("draft"), t.Literal("sent")]),
	sentAt: t.Union([t.String(), t.Null()]),
	timeLockAt: t.Union([t.String(), t.Null()]),
	createdAt: t.String(),
	updatedAt: t.String(),
});

const personSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	name: t.String(),
	relationship: t.Union([t.String(), t.Null()]),
	age: t.Union([t.String(), t.Null()]),
	description: t.Union([t.String(), t.Null()]),
	position: t.Number(),
	createdAt: t.String(),
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

const recipientSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	name: t.Union([t.String(), t.Null()]),
	email: t.Union([t.String(), t.Null()]),
	accessToken: t.String(),
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

export const giftsRoutes = new Elysia({ prefix: "/gifts" })
	.use(authContext)
	.post(
		"/",
		async ({ currentUser, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await createGift(currentUser.xorsUserId, body.intent);
			return { gift };
		},
		{
			body: t.Object({ intent: t.String({ minLength: 1, maxLength: 64 }) }),
			response: {
				200: t.Object({ gift: giftSchema }),
				401: errorSchema,
			},
			detail: { summary: "Create a gift", tags: ["Gifts"] },
		},
	)
	.get(
		"/",
		async ({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gifts = await listGifts(currentUser.xorsUserId);
			return { gifts };
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
		async ({ currentUser, params, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await getGift(params.id, currentUser.xorsUserId);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			const [people, questions, recipient, responses] = await Promise.all([
				listPeople(gift.id),
				listQuestions(gift.id),
				getRecipientByGift(gift.id),
				listResponsesForGift(gift.id),
			]);
			return { gift, people, questions, recipient, responses };
		},
		{
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
			detail: { summary: "Get gift with people + questions + responses", tags: ["Gifts"] },
		},
	)
	.patch(
		"/:id",
		async ({ currentUser, params, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await patchGift(params.id, currentUser.xorsUserId, body);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			return { gift };
		},
		{
			body: t.Partial(
				t.Object({
					about: t.String({ maxLength: 5000 }),
					why: t.String({ maxLength: 5000 }),
					recipientName: t.String({ maxLength: 256 }),
					recipientEmail: t.String({ maxLength: 256 }),
					delivery: t.String({ maxLength: 64 }),
					currentStep: t.String({ maxLength: 64 }),
					timeLockAt: t.Union([t.String(), t.Null()]),
				}),
			),
			response: {
				200: t.Object({ gift: giftSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Update gift fields", tags: ["Gifts"] },
		},
	)
	.put(
		"/:id/people",
		async ({ currentUser, params, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await getGift(params.id, currentUser.xorsUserId);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			const people = await replacePeople(gift.id, body.people);
			return { people };
		},
		{
			body: t.Object({
				people: t.Array(
					t.Object({
						name: t.String({ minLength: 1, maxLength: 256 }),
						relationship: t.Optional(t.String({ maxLength: 256 })),
						age: t.Optional(t.String({ maxLength: 32 })),
						description: t.Optional(t.String({ maxLength: 2000 })),
					}),
				),
			}),
			response: {
				200: t.Object({ people: t.Array(personSchema) }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Replace people list for a gift", tags: ["Gifts"] },
		},
	)
	.post(
		"/:id/questions",
		async ({ currentUser, params, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await getGift(params.id, currentUser.xorsUserId);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			let resolvedText: string;
			if (body.source === "library") {
				const lib = LIBRARY_BY_ID.get(body.templateId);
				if (!lib) {
					set.status = 400;
					return { error: `Unknown template: ${body.templateId}` };
				}
				resolvedText = lib;
				const question = await createQuestion(gift.id, {
					source: "library",
					templateId: body.templateId,
					text: resolvedText,
				});
				return { question };
			}
			resolvedText = body.text;
			const question = await createQuestion(gift.id, {
				source: "custom",
				text: resolvedText,
				preface: body.preface,
			});
			return { question };
		},
		{
			body: t.Union([
				t.Object({
					source: t.Literal("library"),
					templateId: t.String({ minLength: 1, maxLength: 64 }),
				}),
				t.Object({
					source: t.Literal("custom"),
					text: t.String({ minLength: 1, maxLength: 1000 }),
					preface: t.Optional(t.String({ maxLength: 500 })),
				}),
			]),
			response: {
				200: t.Object({ question: questionSchema }),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Add a library or custom question", tags: ["Gifts"] },
		},
	)
	.patch(
		"/:id/questions/:qid",
		async ({ currentUser, params, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await getGift(params.id, currentUser.xorsUserId);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			const question = await patchQuestion(params.qid, gift.id, body);
			if (!question) {
				set.status = 404;
				return { error: "Question not found" };
			}
			return { question };
		},
		{
			body: t.Partial(
				t.Object({
					text: t.String({ minLength: 1, maxLength: 1000 }),
					preface: t.String({ maxLength: 500 }),
					position: t.Number(),
				}),
			),
			response: {
				200: t.Object({ question: questionSchema }),
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Update question text/preface/position", tags: ["Gifts"] },
		},
	)
	.post(
		"/:id/questions/:qid/photo",
		async ({ currentUser, params, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const gift = await getGift(params.id, currentUser.xorsUserId);
			if (!gift) {
				set.status = 404;
				return { error: "Gift not found" };
			}
			const existing = await getQuestion(params.qid, gift.id);
			if (!existing) {
				set.status = 404;
				return { error: "Question not found" };
			}
			const file = body.photo;
			if (!(file instanceof File)) {
				set.status = 400;
				return { error: "Expected multipart 'photo' field with image file" };
			}
			if (!file.type.startsWith("image/")) {
				set.status = 400;
				return { error: "Photo must be an image" };
			}
			// 10MB cap. Larger uploads usually mean a misclick — fail fast rather
			// than burn bandwidth and bucket on something we'll reject downstream.
			if (file.size > 10 * 1024 * 1024) {
				set.status = 413;
				return { error: "Photo must be under 10MB" };
			}
			const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
			const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
			const key = `q-photos/${gift.id}/${existing.id}.${safeExt}`;
			const storage = getPhotoStorage();
			const { url } = await storage.put(key, file);
			const question = await setQuestionPhotoUrl(existing.id, gift.id, url);
			if (!question) {
				set.status = 500;
				return { error: "Failed to record photo URL" };
			}
			return { question };
		},
		{
			body: t.Object({ photo: t.File() }),
			response: {
				200: t.Object({ question: questionSchema }),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
				413: errorSchema,
				500: errorSchema,
			},
			detail: { summary: "Upload custom-question photo to S3", tags: ["Gifts"] },
		},
	)
	.post(
		"/:id/send",
		async ({ currentUser, params, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const result = await sendGift(params.id, currentUser.xorsUserId);
			if ("error" in result) {
				if (result.error === "not_found") {
					set.status = 404;
					return { error: "Gift not found" };
				}
				if (result.error === "missing_recipient") {
					set.status = 400;
					return { error: "Recipient name + email required before sending" };
				}
			}
			const sent = result as Exclude<typeof result, { error: string }>;
			return {
				gift: sent.gift,
				recipient: sent.recipient,
				alreadySent: sent.alreadySent,
			};
		},
		{
			response: {
				200: t.Object({
					gift: giftSchema,
					recipient: recipientSchema,
					alreadySent: t.Boolean(),
				}),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Send gift — creates recipient + token", tags: ["Gifts"] },
		},
	);

// Library ID → text. Mirrors web/app/onboarding/questions/_lib/library.ts.
// Kept in sync manually (small, rarely changes); break this out into a
// shared package the day it bites.
const LIBRARY_BY_ID = new Map<string, string>([
	["ch1", "Tell me about the day I was born."],
	["ch2", "What's a memory of me as a kid that still makes you laugh?"],
	["ch3", "What did you wish you'd known before you became a parent?"],
	["ch4", "What was I like at three?"],
	["ch5", "What was your first house like?"],
	["ch6", "What did you used to do on Sundays when you were small?"],
	["lv1", "How did you know?"],
	["lv2", "What did you fight about, in the early years?"],
	["lv3", "What does loving someone for forty years actually feel like?"],
	["lv4", "What's the smallest thing you do for the people you love?"],
	["lv5", "What did your mother teach you about love?"],
	["wd1", "What's something only your mother knew about you?"],
	["wd2", "What's the hardest thing you've ever had to forgive?"],
	["wd3", "What advice do you wish someone had given you?"],
	["wd4", "What's something you used to believe that you don't anymore?"],
	["wd5", "When did you stop being afraid of something?"],
	["ev1", 'What does "we\'ll see" really mean?'],
	["ev2", "What's your morning look like, really?"],
	["ev3", "What's a song that always brings you back?"],
	["ev4", "What's the last thing that made you cry?"],
	["ev5", "What's a small ritual you've never told anyone about?"],
	["ts1", "Where do you feel most at home?"],
	["ts2", "What's the moment you remember most clearly from your twenties?"],
	["ts3", "What's a place you've never gone back to?"],
	["ts4", "What's a job you almost took?"],
	["ts5", "Tell me about your best friend in school."],
]);
