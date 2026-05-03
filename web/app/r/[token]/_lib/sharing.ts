export type SharingMode = "when-ready" | "legacy" | "date" | "milestone"

export type MilestonePreset =
	| "future-birthday"
	| "anniversary"
	| "in-one-year"
	| "custom"

export type SharingState = {
	mode: SharingMode
	date?: string // ISO yyyy-mm-dd for "date" mode
	milestonePreset?: MilestonePreset
	milestoneText?: string // for "custom" milestone
	sharedAt?: string // ISO when "Share what I've written so far" was tapped
	lastSharedSnapshotCount?: number
}

export const DEFAULT_SHARING: SharingState = { mode: "when-ready" }

export function readSharing(
	data: Record<string, unknown>,
): SharingState {
	const raw = data.sharing as SharingState | undefined
	return { ...DEFAULT_SHARING, ...(raw ?? {}) }
}

export function isArchived(data: Record<string, unknown>): boolean {
	return Boolean(readSharing(data).sharedAt)
}

export function sharingDisplay(s: SharingState): {
	title: string
	sub: string
} {
	switch (s.mode) {
		case "when-ready":
			return {
				title: "Hold — share when I decide",
				sub: "Nothing leaves until you say so.",
			}
		case "legacy":
			return {
				title: "As a legacy, when I'm gone",
				sub: "Held safely until then.",
			}
		case "date":
			return s.date
				? {
						title: `On ${formatLongDate(s.date)}`,
						sub: "We'll send it automatically.",
					}
				: {
						title: "On a specific date",
						sub: "Pick a day to send it automatically.",
					}
		case "milestone":
			return {
				title: milestonePresetLabel(s.milestonePreset, s.milestoneText),
				sub: "We'll send it automatically.",
			}
	}
}

export function milestonePresetLabel(
	preset?: MilestonePreset,
	custom?: string,
): string {
	switch (preset) {
		case "future-birthday":
			return "On a future birthday"
		case "anniversary":
			return "On an anniversary"
		case "in-one-year":
			return "In one year"
		case "custom":
			return custom?.trim() || "On a milestone"
		default:
			return "On a milestone"
	}
}

export function formatLongDate(iso: string): string {
	try {
		const [y, m, d] = iso.split("-").map(Number)
		const dt = new Date(y, (m ?? 1) - 1, d)
		return new Intl.DateTimeFormat("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		}).format(dt)
	} catch {
		return iso
	}
}
