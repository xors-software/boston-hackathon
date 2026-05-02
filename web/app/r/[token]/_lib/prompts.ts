// Backend will serve the prompts the giver curated for this gift, keyed by
// token. Hardcoded for now so the design renders.
export type ParentPrompt = {
	id: string
	text: string
}

export const PARENT_PROMPTS: ParentPrompt[] = [
	{ id: "p1", text: "What's something you've never told anyone?" },
	{ id: "p2", text: "Describe a smell that takes you back." },
	{ id: "p3", text: "What scared you as a kid?" },
	{ id: "p4", text: "A kitchen you remember well." },
	{ id: "p5", text: "What did you want to be when you were ten?" },
	{ id: "p6", text: "A song that always brings you back." },
	{ id: "p7", text: "Who was your closest friend at fifteen?" },
	{ id: "p8", text: "What's a small ritual you've never told anyone about?" },
	{ id: "p9", text: "What's the best meal you've ever eaten?" },
	{ id: "p10", text: "Where do you feel most at home?" },
	{ id: "p11", text: "What's something you used to believe that you don't anymore?" },
	{ id: "p12", text: "What's the last thing that made you cry?" },
]

const INDEX = new Map(PARENT_PROMPTS.map((p) => [p.id, p]))

export function findPrompt(id: string): ParentPrompt | undefined {
	return INDEX.get(id)
}
