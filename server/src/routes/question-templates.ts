import { Elysia, t } from "elysia";
import {
	type QuestionCategory,
	searchTemplates,
} from "../lib/question-templates";

const categorySchema = t.Union([
	t.Literal("childhood"),
	t.Literal("love"),
	t.Literal("wisdom"),
	t.Literal("everyday"),
	t.Literal("their-story"),
]);

const filterSchema = t.Union([t.Literal("suggested"), categorySchema]);

const templateSchema = t.Object({
	id: t.String(),
	text: t.String(),
	categories: t.Array(categorySchema),
	suggested: t.Boolean(),
});

export const questionTemplatesRoutes = new Elysia({
	prefix: "/question-templates",
}).get(
	"/",
	({ query }) => {
		const category = query.category as QuestionCategory | "suggested" | undefined;
		const q = query.q as string | undefined;
		return { templates: searchTemplates({ category, q }) };
	},
	{
		query: t.Object({
			category: t.Optional(filterSchema),
			q: t.Optional(t.String({ maxLength: 200 })),
		}),
		response: {
			200: t.Object({ templates: t.Array(templateSchema) }),
		},
		detail: {
			summary: "List question templates (library)",
			tags: ["Questions"],
		},
	},
);
