import { Elysia, t } from "elysia"
import {
	getGiftById,
	listQuestionsForGift,
	listResponsesForGift,
} from "../lib/ember-store"
import { authContext } from "../lib/xors-identity"

const errorSchema = t.Object({ error: t.String() })

const giftSchema = t.Object({
	id: t.String(),
	userId: t.String(),
	intent: t.Union([
		t.Literal("mom"),
		t.Literal("dad"),
		t.Literal("loved-one"),
		t.Literal("undecided"),
	]),
	about: t.String(),
	why: t.String(),
	delivery: t.Union([t.Literal("email"), t.Literal("in-person"), t.Null()]),
	recipientName: t.Union([t.String(), t.Null()]),
	recipientEmail: t.Union([t.String(), t.Null()]),
	currentStep: t.String(),
	status: t.Union([
		t.Literal("draft"),
		t.Literal("sent"),
		t.Literal("archived"),
	]),
	sentAt: t.Union([t.String(), t.Null()]),
	timeLockAt: t.Union([t.String(), t.Null()]),
	timeLockKind: t.Union([
		t.Literal("date"),
		t.Literal("milestone"),
		t.Literal("after_passing"),
		t.Null(),
	]),
	releasedAt: t.Union([t.String(), t.Null()]),
	createdAt: t.String(),
	updatedAt: t.String(),
})

const questionSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	source: t.Union([t.Literal("library"), t.Literal("custom")]),
	templateId: t.Union([t.String(), t.Null()]),
	text: t.String(),
	photoUrl: t.Union([t.String(), t.Null()]),
	preface: t.Union([t.String(), t.Null()]),
	position: t.Number(),
	createdAt: t.String(),
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

export const giftsRoutes = new Elysia({ prefix: "/gifts" })
	.use(authContext)
	.get(
		"/:id",
		({ currentUser, params: { id }, set }) => {
			if (!currentUser) {
				set.status = 401
				return { error: "Not authenticated" }
			}
			const gift = getGiftById(id)
			// 404 (not 403) on cross-user reads — don't leak existence.
			if (!gift || gift.userId !== currentUser.id) {
				set.status = 404
				return { error: "Gift not found" }
			}
			return {
				gift,
				questions: listQuestionsForGift(gift.id),
				responses: listResponsesForGift(gift.id),
			}
		},
		{
			params: t.Object({ id: t.String({ minLength: 1 }) }),
			response: {
				200: t.Object({
					gift: giftSchema,
					questions: t.Array(questionSchema),
					responses: t.Array(responseSchema),
				}),
				401: errorSchema,
				404: errorSchema,
			},
			detail: {
				summary: "Get a gift with its questions and recipient responses",
				tags: ["Gifts"],
			},
		},
	)
