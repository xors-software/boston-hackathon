// Source of truth for the curated question library. Mirrors the
// frontend file at web/app/onboarding/questions/_lib/library.ts —
// keep them in sync until the frontend reads from the API.

export type QuestionCategory =
	| "childhood"
	| "love"
	| "wisdom"
	| "everyday"
	| "their-story";

export interface QuestionTemplate {
	id: string;
	text: string;
	categories: QuestionCategory[];
	suggested: boolean;
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
	{ id: "ch1", text: "Tell me about the day I was born.", categories: ["childhood"], suggested: true },
	{ id: "ch2", text: "What's a memory of me as a kid that still makes you laugh?", categories: ["childhood"], suggested: true },
	{ id: "ch3", text: "What did you wish you'd known before you became a parent?", categories: ["childhood", "wisdom"], suggested: false },
	{ id: "ch4", text: "What was I like at three?", categories: ["childhood"], suggested: false },
	{ id: "ch5", text: "What was your first house like?", categories: ["childhood", "their-story"], suggested: false },
	{ id: "ch6", text: "What did you used to do on Sundays when you were small?", categories: ["childhood"], suggested: false },

	{ id: "lv1", text: "How did you know?", categories: ["love"], suggested: true },
	{ id: "lv2", text: "What did you fight about, in the early years?", categories: ["love"], suggested: false },
	{ id: "lv3", text: "What does loving someone for forty years actually feel like?", categories: ["love"], suggested: false },
	{ id: "lv4", text: "What's the smallest thing you do for the people you love?", categories: ["love", "everyday"], suggested: false },
	{ id: "lv5", text: "What did your mother teach you about love?", categories: ["love", "wisdom"], suggested: false },

	{ id: "wd1", text: "What's something only your mother knew about you?", categories: ["wisdom"], suggested: true },
	{ id: "wd2", text: "What's the hardest thing you've ever had to forgive?", categories: ["wisdom"], suggested: false },
	{ id: "wd3", text: "What advice do you wish someone had given you?", categories: ["wisdom"], suggested: false },
	{ id: "wd4", text: "What's something you used to believe that you don't anymore?", categories: ["wisdom"], suggested: false },
	{ id: "wd5", text: "When did you stop being afraid of something?", categories: ["wisdom"], suggested: false },

	{ id: "ev1", text: "What does \"we'll see\" really mean?", categories: ["everyday"], suggested: true },
	{ id: "ev2", text: "What's your morning look like, really?", categories: ["everyday"], suggested: false },
	{ id: "ev3", text: "What's a song that always brings you back?", categories: ["everyday"], suggested: true },
	{ id: "ev4", text: "What's the last thing that made you cry?", categories: ["everyday"], suggested: false },
	{ id: "ev5", text: "What's a small ritual you've never told anyone about?", categories: ["everyday"], suggested: false },

	{ id: "ts1", text: "Where do you feel most at home?", categories: ["their-story"], suggested: true },
	{ id: "ts2", text: "What's the moment you remember most clearly from your twenties?", categories: ["their-story"], suggested: false },
	{ id: "ts3", text: "What's a place you've never gone back to?", categories: ["their-story"], suggested: false },
	{ id: "ts4", text: "What's a job you almost took?", categories: ["their-story"], suggested: false },
	{ id: "ts5", text: "Tell me about your best friend in school.", categories: ["their-story"], suggested: true },
];

const TEMPLATE_BY_ID = new Map(QUESTION_TEMPLATES.map((t) => [t.id, t]));

export function findTemplate(id: string): QuestionTemplate | null {
	return TEMPLATE_BY_ID.get(id) ?? null;
}

export function searchTemplates(opts: {
	category?: QuestionCategory | "suggested";
	q?: string;
}): QuestionTemplate[] {
	let results = QUESTION_TEMPLATES;
	const search = opts.q?.trim().toLowerCase();
	if (search) {
		results = results.filter((t) => t.text.toLowerCase().includes(search));
	}
	if (opts.category === "suggested") {
		return results.filter((t) => t.suggested);
	}
	if (opts.category) {
		return results.filter((t) => t.categories.includes(opts.category as QuestionCategory));
	}
	return results;
}
