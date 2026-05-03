"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { BottomTabs } from "../_components/BottomTabs"
import type { JournalEntry } from "../_lib/entries"
import { PARENT_PROMPTS, type ParentPrompt } from "../_lib/prompts"
import { isArchived } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

type Filter = "all" | "used"

const FILTERS: Array<{ id: Filter; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "used", label: "Used" },
]

export default function PromptsPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated } = useParentState(token)

	const [filter, setFilter] = useState<Filter>("all")

	const entries = (state.data.entries as JournalEntry[] | undefined) ?? []
	const usedIds = useMemo(
		() => new Set(entries.map((e) => e.promptId).filter(Boolean) as string[]),
		[entries],
	)

	const ordered = useMemo(() => {
		const unused: ParentPrompt[] = []
		const used: ParentPrompt[] = []
		for (const p of PARENT_PROMPTS) {
			if (usedIds.has(p.id)) used.push(p)
			else unused.push(p)
		}
		return { unused, used }
	}, [usedIds])

	const visible = useMemo(() => {
		if (filter === "used") return { unused: [], used: ordered.used }
		return ordered
	}, [filter, ordered])

	const archived = isArchived(state.data)

	const open = (p: ParentPrompt, isUsed: boolean) => {
		if (isUsed || archived) return
		router.push(`/r/${token}/journal/new?promptId=${p.id}`)
	}

	if (!hydrated) return null

	return (
		<main className="min-h-dvh w-full bg-[color:var(--ember-card)]">
			<div className="mx-auto w-full max-w-md pb-32">
				<header
					className="px-6 pt-6 pb-6 sm:px-8"
					style={{ backgroundColor: "var(--ember-cream)" }}
				>
					<p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[color:var(--ember-warm-gray)] mb-2">
						Inspiration
					</p>
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)] mb-1">
						Prompts to gently nudge you
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)]">
						Use them, ignore them.
					</p>
				</header>

				<div className="px-6 sm:px-8 border-b border-[color:var(--ember-divider)]">
					<div className="flex items-center gap-6 py-3">
						{FILTERS.map((f) => {
							const isActive = filter === f.id
							return (
								<button
									key={f.id}
									type="button"
									onClick={() => setFilter(f.id)}
									className={`relative pb-2 -mb-3 text-base transition-colors ${
										isActive
											? "text-[color:var(--ember-ink)]"
											: "text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-warm-gray)]"
									}`}
									style={isActive ? { color: "var(--ember-terracotta)" } : undefined}
								>
									{f.label}
									{isActive && (
										<span
											className="absolute left-0 right-0 -bottom-px h-[2px]"
											style={{ backgroundColor: "var(--ember-terracotta)" }}
										/>
									)}
								</button>
							)
						})}
					</div>
				</div>

				{archived && (
					<div
						className="px-6 sm:px-8 py-3 text-sm"
						style={{ backgroundColor: "var(--ember-cream)", color: "var(--ember-terracotta)" }}
					>
						Your journal is shared. Prompts are read-only now.
					</div>
				)}

				<ul className="divide-y divide-neutral-200">
					{visible.unused.map((p) => (
						<PromptRow
							key={p.id}
							prompt={p}
							used={archived}
							onOpen={() => open(p, archived)}
						/>
					))}
					{visible.used.map((p) => (
						<PromptRow
							key={p.id}
							prompt={p}
							used={true}
							onOpen={() => open(p, true)}
						/>
					))}

					{visible.unused.length === 0 && visible.used.length === 0 && (
						<li className="px-6 py-10 text-center text-sm text-[color:var(--ember-warm-gray)]">
							{filter === "used"
								? "No prompts written about yet."
								: "No prompts available."}
						</li>
					)}
				</ul>
			</div>

			<BottomTabs token={token} active="prompts" />
		</main>
	)
}

function PromptRow({
	prompt,
	used,
	onOpen,
}: {
	prompt: ParentPrompt
	used: boolean
	onOpen: () => void
}) {
	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				disabled={used}
				className={`w-full flex items-start gap-3 px-6 py-4 text-left transition-colors ${
					used ? "cursor-default" : "hover:bg-[color:var(--ember-cream-light)] active:bg-neutral-100"
				}`}
			>
				<span
					className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
						used ? "border-transparent" : "border-[color:var(--ember-divider)]"
					}`}
					style={used ? { color: "var(--ember-terracotta)" } : undefined}
				>
					{used && (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-4 w-4"
							aria-hidden="true"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					)}
				</span>
				<div className="flex-1 min-w-0">
					<p
						className={`text-base italic leading-snug ${
							used ? "text-[color:var(--ember-soft-gray)]" : "text-[color:var(--ember-ink)]"
						}`}
					>
						"{prompt.text}"
					</p>
					<p
						className={`mt-1.5 text-[11px] font-medium tracking-[0.18em] uppercase ${
							used ? "text-[color:var(--ember-soft-gray)]" : "text-[color:var(--ember-warm-gray)]"
						}`}
					>
						{used ? "Written about" : "Tap to write"}
					</p>
				</div>
			</button>
		</li>
	)
}
