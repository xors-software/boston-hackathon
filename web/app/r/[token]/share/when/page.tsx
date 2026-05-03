"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
	type MilestonePreset,
	readSharing,
	type SharingMode,
	type SharingState,
} from "../../_lib/sharing"
import { useParentState } from "../../_lib/state"

type Option = {
	id: SharingMode
	title: string
	body: string
	recommended?: boolean
}

const OPTIONS: Option[] = [
	{
		id: "when-ready",
		title: "When I'm ready",
		body: "Hold onto it. Share it whenever the moment feels right — tomorrow, in five years, on a special day.",
		recommended: true,
	},
	{
		id: "legacy",
		title: "As a legacy, when I'm gone",
		body: "Leave it as something to be received after you. We'll keep it safe until then.",
	},
	{
		id: "date",
		title: "On a specific date",
		body: "Pick a day. We'll send it automatically.",
	},
	{
		id: "milestone",
		title: "A milestone",
		body: "A future birthday · An anniversary · In one year",
	},
]

const MILESTONE_PRESETS: Array<{ id: MilestonePreset; label: string }> = [
	{ id: "future-birthday", label: "A future birthday" },
	{ id: "anniversary", label: "An anniversary" },
	{ id: "in-one-year", label: "In one year" },
	{ id: "custom", label: "Something else" },
]

export default function ShareWhenPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated, update } = useParentState(token)

	const [draft, setDraft] = useState<SharingState>({ mode: "when-ready" })

	useEffect(() => {
		if (!hydrated) return
		setDraft(readSharing(state.data))
	}, [hydrated, state.data])

	const select = (mode: SharingMode) => {
		setDraft((d) => ({ ...d, mode }))
	}

	const canContinue = (() => {
		if (draft.mode === "date") return Boolean(draft.date)
		if (draft.mode === "milestone") {
			if (!draft.milestonePreset) return false
			if (!draft.date) return false
			if (draft.milestonePreset === "custom")
				return Boolean(draft.milestoneText?.trim())
			return true
		}
		return true
	})()

	const onContinue = () => {
		if (!canContinue) return
		const next: SharingState = (() => {
			if (draft.mode === "date") return { mode: "date", date: draft.date }
			if (draft.mode === "milestone")
				return {
					mode: "milestone",
					milestonePreset: draft.milestonePreset,
					date: draft.date,
					milestoneText:
						draft.milestonePreset === "custom"
							? draft.milestoneText?.trim()
							: undefined,
				}
			return { mode: draft.mode }
		})()
		update({ data: { sharing: { ...readSharing(state.data), ...next } } })
		router.push(`/r/${token}/share`)
	}

	const todayStr = new Date().toISOString().slice(0, 10)
	const inOneYearStr = (() => {
		const d = new Date()
		d.setFullYear(d.getFullYear() + 1)
		return d.toISOString().slice(0, 10)
	})()

	const pickMilestone = (preset: MilestonePreset) => {
		setDraft((d) => ({
			...d,
			milestonePreset: preset,
			date:
				preset === "in-one-year"
					? inOneYearStr
					: d.milestonePreset === preset
						? d.date
						: undefined,
		}))
	}

	return (
		<main className="min-h-dvh w-full bg-[color:var(--ember-card)]">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-32 sm:px-8">
				<button
					type="button"
					onClick={() => router.back()}
					className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:text-[color:var(--ember-ink)]"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="h-4 w-4"
					>
						<polyline points="15 6 9 12 15 18" />
					</svg>
					Back
				</button>

				<header className="mt-6 mb-8">
					<p
						className="text-[11px] font-medium tracking-[0.22em] uppercase mb-3"
						style={{ color: "var(--ember-terracotta)" }}
					>
						Sharing
					</p>
					<h1 className="font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)] mb-3">
						How and <span className="italic" style={{ color: "var(--ember-terracotta)" }}>when</span> to share.
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Your journal is yours. If you'd like to share it, you choose when —
						there's no rush.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{OPTIONS.map((opt) => {
						const isSelected = draft.mode === opt.id
						return (
							<div key={opt.id}>
								<button
									type="button"
									onClick={() => select(opt.id)}
									aria-pressed={isSelected}
									className={`w-full text-left rounded-2xl border bg-[color:var(--ember-card)] px-5 py-4 transition-colors ${
										isSelected
											? "border-neutral-900"
											: "border-[color:var(--ember-divider)] hover:border-[color:var(--ember-divider)] hover:bg-[color:var(--ember-cream-light)]"
									}`}
								>
									<div className="text-base font-semibold text-[color:var(--ember-ink)] mb-1">
										{opt.title}
									</div>
									<div className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
										{opt.body}
									</div>
									{opt.recommended && (
										<div
											className="mt-3 text-[10px] font-medium tracking-[0.18em] uppercase"
											style={{ color: "#A89A82" }}
										>
											Recommended
										</div>
									)}
								</button>

								{isSelected && opt.id === "date" && (
									<div className="mt-2 px-2">
										<label className="flex flex-col gap-2">
											<span className="text-sm font-medium text-[color:var(--ember-warm-gray)]">
												Pick a date
											</span>
											<input
												type="date"
												value={draft.date ?? ""}
												min={todayStr}
												onChange={(e) =>
													setDraft((d) => ({ ...d, date: e.target.value }))
												}
												className="w-full rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-4 py-3 text-base text-[color:var(--ember-ink)] outline-none focus:border-neutral-900 transition-colors"
											/>
										</label>
									</div>
								)}

								{isSelected && opt.id === "milestone" && (
									<div className="mt-2 px-2 flex flex-col gap-3">
										<div className="flex flex-wrap gap-2">
											{MILESTONE_PRESETS.map((m) => {
												const active = draft.milestonePreset === m.id
												return (
													<button
														key={m.id}
														type="button"
														onClick={() => pickMilestone(m.id)}
														className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
															active
																? "border-neutral-900 bg-neutral-900 text-white"
																: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] text-[color:var(--ember-warm-gray)] hover:border-neutral-400"
														}`}
													>
														{m.label}
													</button>
												)
											})}
										</div>
										{draft.milestonePreset === "custom" && (
											<input
												type="text"
												placeholder="Describe the milestone…"
												value={draft.milestoneText ?? ""}
												onChange={(e) =>
													setDraft((d) => ({
														...d,
														milestoneText: e.target.value,
													}))
												}
												className="w-full rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-4 py-3 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
											/>
										)}
										{draft.milestonePreset && (
											<label className="flex flex-col gap-2">
												<span className="text-sm font-medium text-[color:var(--ember-warm-gray)]">
													Pick the date
												</span>
												<input
													type="date"
													value={draft.date ?? ""}
													min={todayStr}
													onChange={(e) =>
														setDraft((d) => ({ ...d, date: e.target.value }))
													}
													className="w-full rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-4 py-3 text-base text-[color:var(--ember-ink)] outline-none focus:border-neutral-900 transition-colors"
												/>
											</label>
										)}
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 border-t border-[color:var(--ember-divider)] bg-[color:var(--ember-card)]">
				<div className="mx-auto w-full max-w-md px-6 py-4 sm:px-8">
					<button
						type="button"
						onClick={onContinue}
						disabled={!canContinue}
						className="ember-cta"
					>
						Continue
					</button>
				</div>
			</div>
		</main>
	)
}
