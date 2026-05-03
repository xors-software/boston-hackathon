import Anthropic from "@anthropic-ai/sdk";
import type { Gift, Person } from "./gift-store";
import { QUESTION_TEMPLATES } from "./question-templates";

// Mirrors the model + tone choices in `routes/ai.ts`. Suggestions are
// disposable — frontend can POST any picked ones back as `source: 'ai'`
// to persist; we don't write them to the DB ourselves.

const MODEL = "claude-opus-4-7";

const RELATIONSHIP_LABEL: Record<Gift["intent"], string> = {
	mom: "mom",
	dad: "dad",
	"loved-one": "loved one (partner, grandparent, friend, etc.)",
	undecided: "loved one — they haven't decided exactly who yet",
};

export interface SuggestedQuestion {
	id: string;
	text: string;
	source: "ai";
}

function buildSystemPrompt(): string {
	const libraryLines = QUESTION_TEMPLATES.map(
		(t, i) => `${i + 1}. ${t.text}`,
	).join("\n");

	return `You are Ember, helping someone curate questions for a memory gift for their loved one. Based on the giver's specific context, suggest 6 to 10 questions personalized to this recipient — the questions will be sent to the recipient to answer in their own time, in their own words.

How you write each question:
- Warm. Present-tense. Alive. Never grief-coded.
- Pull on the specific. If the giver mentions a phrase the recipient says, build a question around that phrase. If they mention a habit, ask about its origin. If they name a person in the recipient's world, ask about them.
- Concrete, not abstract. "What did you used to do on Sundays?" beats "What was your childhood like?"
- Single-clause. Short. Conversational. End with a question mark.
- No platitudes. No therapist voice. No "meaningful" / "profound" / "beautiful" framing.
- Never speak as the recipient. Never simulate them. You are writing prompts for them to fill in.

Use the curated library below as a tonal reference — match its texture. Do NOT copy any line verbatim. Do not paraphrase a library line into something nearly identical. Each suggestion must be earned by the giver's specific context (their about / why / people), not by mild-rephrasing the library.

Curated library (texture reference):
${libraryLines}

Output format: a single JSON object with one key, "suggestions", whose value is an array of 6 to 10 objects, each with a single "text" field — the question. No other fields. No prose. No preamble. No code fences. Just the JSON object.`;
}

function buildUserMessage(
	gift: Gift,
	people: Person[],
): string {
	const relationship = RELATIONSHIP_LABEL[gift.intent];
	const lines: string[] = [];
	lines.push(`The recipient is the giver's ${relationship}.`);
	if (gift.recipientName && gift.recipientName !== "Them") {
		lines.push(`Recipient's name: ${gift.recipientName}.`);
	}

	const about = gift.about?.trim();
	if (about) {
		lines.push("", "What the giver shared about the recipient:", about);
	} else {
		lines.push(
			"",
			"The giver hasn't written anything specific about the recipient yet.",
		);
	}

	const why = gift.why?.trim();
	if (why) {
		lines.push("", "Why the giver is making this gift:", why);
	} else {
		lines.push("", "The giver hasn't written down their reason yet.");
	}

	if (people.length > 0) {
		lines.push("", "People in the recipient's world:");
		for (const p of people) {
			const ageBit = p.age?.trim() ? `, ${p.age}` : "";
			const descBit = p.description?.trim() ? ` — ${p.description.trim()}` : "";
			lines.push(`- ${p.name} (${p.relationship}${ageBit})${descBit}`);
		}
	}

	lines.push(
		"",
		"Suggest 6 to 10 questions personalized to this recipient. Output the JSON object only.",
	);
	return lines.join("\n");
}

function extractText(blocks: Anthropic.Messages.ContentBlock[]): string {
	return blocks
		.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
		.map((b) => b.text)
		.join("\n")
		.trim();
}

// Claude 4 reliably emits clean JSON when asked, but defensively strip
// fenced blocks if it adds them anyway.
function parseSuggestions(raw: string): string[] {
	let s = raw.trim();
	if (s.startsWith("```")) {
		s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
	}
	const start = s.indexOf("{");
	const end = s.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error("Model response did not contain a JSON object");
	}
	const json = s.slice(start, end + 1);
	const parsed = JSON.parse(json);
	if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.suggestions)) {
		throw new Error("Model response missing 'suggestions' array");
	}
	const out: string[] = [];
	for (const item of parsed.suggestions) {
		const text = typeof item?.text === "string" ? item.text.trim() : "";
		if (text) out.push(text);
	}
	return out;
}

function makeId(index: number): string {
	const r = Math.random().toString(36).slice(2, 8);
	return `ai_${Date.now().toString(36)}_${index}_${r}`;
}

export class SuggestQuestionsError extends Error {
	readonly status: number;
	constructor(message: string, status = 500) {
		super(message);
		this.status = status;
	}
}

export async function suggestQuestionsForGift(
	gift: Gift,
	people: Person[],
): Promise<SuggestedQuestion[]> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new SuggestQuestionsError("ANTHROPIC_API_KEY is not configured", 500);
	}

	const client = new Anthropic({ apiKey });
	let response: Anthropic.Messages.Message;
	try {
		response = await client.messages.create({
			model: MODEL,
			max_tokens: 1024,
			// System prompt + library text is ~700 tokens — below Anthropic's
			// 1024-token cache minimum for Opus, so prompt caching is a no-op.
			// Add `cache_control` blocks here if the library grows past that.
			system: buildSystemPrompt(),
			messages: [{ role: "user", content: buildUserMessage(gift, people) }],
		});
	} catch (err) {
		if (err instanceof Anthropic.APIError) {
			throw new SuggestQuestionsError(err.message, err.status ?? 500);
		}
		throw new SuggestQuestionsError("Suggestion call failed", 500);
	}

	const raw = extractText(response.content);
	let texts: string[];
	try {
		texts = parseSuggestions(raw);
	} catch (err) {
		console.error("suggest-questions parse error:", err, "raw=", raw);
		throw new SuggestQuestionsError(
			"Model returned an unparseable response",
			502,
		);
	}

	if (texts.length === 0) {
		throw new SuggestQuestionsError("Model returned no suggestions", 502);
	}

	return texts.slice(0, 10).map((text, i) => ({
		id: makeId(i),
		text,
		source: "ai" as const,
	}));
}
