export type JournalEntrySource =
	| "free-write"
	| "prompt"
	| "ai"
	| "voice"
	| "photo"

export type JournalEntry = {
	id: string
	createdAt: string // ISO
	source: JournalEntrySource
	title?: string
	text?: string
	promptText?: string
	promptId?: string
	photoDataUrl?: string
	audioDataUrl?: string
	durationSeconds?: number
}

export function newEntryId(): string {
	return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function entryDisplayTitle(entry: JournalEntry): string {
	if (entry.title?.trim()) return entry.title
	if (entry.source === "voice") return "A voice note"
	if (entry.source === "photo") return "A photo"
	if (entry.source === "ai") return "A conversation with Ember"
	if (entry.source === "free-write") {
		const first = (entry.text ?? "").split(/[.\n]/)[0]?.trim() ?? ""
		return first.length > 0 ? first.slice(0, 60) : "Free entry"
	}
	if (entry.source === "prompt") {
		return (entry.text ?? "").split(/[.\n]/)[0]?.slice(0, 60) || "Prompt entry"
	}
	return "Entry"
}

export function entryPreview(entry: JournalEntry): string | undefined {
	if (entry.source === "voice")
		return entry.durationSeconds
			? `${Math.max(1, Math.round(entry.durationSeconds / 60))} min · audio + transcript`
			: "audio + transcript"
	if (entry.source === "photo") return entry.text || "photo"
	const text = entry.text?.trim()
	if (!text) return undefined
	return text.length > 140 ? `${text.slice(0, 140)}…` : text
}
