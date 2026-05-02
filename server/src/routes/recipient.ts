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

const giverSchema = t.Object({
	recipientName: t.String(),
});

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
