"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AvatarMenu } from "../_components/AvatarMenu"
import { BottomTabs } from "../_components/BottomTabs"
import {
	type JournalEntry,
	entryDisplayTitle,
	entryPreview,
} from "../_lib/entries"
import { isArchived, readSharing } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

type View = "list" | "calendar" | "media"

const VIEWS: Array<{ id: View; label: string; icon: React.ReactNode }> = [
	{
		id: "list",
		label: "List",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				className="h-4 w-4"
				aria-hidden="true"
			>
				<line x1="4" y1="7" x2="20" y2="7" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="17" x2="20" y2="17" />
			</svg>
		),
	},
	{
		id: "calendar",
		label: "Calendar",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				className="h-4 w-4"
				aria-hidden="true"
			>
				<rect x="3" y="5" width="18" height="16" rx="2" />
				<line x1="3" y1="10" x2="21" y2="10" />
				<line x1="8" y1="3" x2="8" y2="7" />
				<line x1="16" y1="3" x2="16" y2="7" />
			</svg>
		),
	},
	{
		id: "media",
		label: "Media",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				className="h-4 w-4"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<circle cx="9" cy="9" r="1.5" />
				<polyline points="21 16 15 10 5 20" />
			</svg>
		),
	},
]

export default function JournalPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated } = useParentState(token)

	const [view, setView] = useState<View>("list")

	const entries = useMemo<JournalEntry[]>(() => {
		const raw = (state.data.entries as JournalEntry[] | undefined) ?? []
		return [...raw].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
	}, [state.data.entries])

	const initial =
		(state.data.email as string | undefined)?.[0]?.toUpperCase() ?? "M"
	const archived = hydrated && isArchived(state.data)
	const sharedAt = readSharing(state.data).sharedAt

	if (!hydrated) return null

	return (
		<main className="min-h-dvh w-full bg-[color:var(--ember-card)]">
			<div className="mx-auto w-full max-w-md pb-32">
				<header
					className="px-6 pt-6 pb-6 sm:px-8"
					style={{ backgroundColor: "var(--ember-cream)" }}
				>
					<div className="flex items-center justify-end mb-6">
						<AvatarMenu initial={initial} bg="#FFFFFF" border />
					</div>

					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)] mb-1">
						Your journal
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)]">
						A quiet place to gather things
					</p>
				</header>

				<div className="px-6 sm:px-8 border-b border-[color:var(--ember-divider)]">
					<div className="flex items-center gap-6 py-3">
						{VIEWS.map((v) => {
							const isActive = view === v.id
							return (
								<button
									key={v.id}
									type="button"
									onClick={() => setView(v.id)}
									className={`relative inline-flex items-center gap-1.5 pb-2 -mb-3 text-base transition-colors ${
										isActive
											? "text-[color:var(--ember-ink)]"
											: "text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-warm-gray)]"
									}`}
								>
									{v.icon}
									{v.label}
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

				{archived && sharedAt && (
					<div
						className="mx-6 sm:mx-8 mt-4 rounded-2xl px-4 py-3 text-sm"
						style={{ backgroundColor: "var(--ember-cream)", color: "var(--ember-ink)" }}
					>
						<div
							className="text-[10px] font-medium tracking-[0.18em] uppercase mb-1"
							style={{ color: "var(--ember-terracotta)" }}
						>
							Archived
						</div>
						Shared on{" "}
						{new Intl.DateTimeFormat("en-US", {
							month: "long",
							day: "numeric",
							year: "numeric",
						}).format(new Date(sharedAt))}
						. Read-only.
					</div>
				)}

				<div className="px-6 sm:px-8 mt-6">
					{view === "list" && <ListView entries={entries} />}
					{view === "calendar" && <CalendarView entries={entries} />}
					{view === "media" && <MediaView entries={entries} />}
				</div>
			</div>

			{!archived && (
				<button
					type="button"
					onClick={() => router.push(`/r/${token}/journal/new`)}
					className="fixed right-5 bottom-24 z-10 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-neutral-800 active:bg-neutral-700"
				>
					+ New entry
				</button>
			)}

			<BottomTabs token={token} active="journal" />
		</main>
	)
}

// ───────── views ─────────

function ListView({ entries }: { entries: JournalEntry[] }) {
	if (entries.length === 0) return <EmptyState />

	const grouped = groupByMonth(entries)

	return (
		<div className="flex flex-col gap-8">
			{grouped.map((group) => (
				<section key={group.key}>
					<h2 className="text-[11px] font-medium tracking-[0.18em] uppercase text-[color:var(--ember-warm-gray)] mb-3">
						{group.label}
					</h2>
					<ul className="flex flex-col">
						{group.entries.map((entry, idx) => (
							<EntryRow
								key={entry.id}
								entry={entry}
								last={idx === group.entries.length - 1}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}

function EntryRow({ entry, last }: { entry: JournalEntry; last: boolean }) {
	const date = new Date(entry.createdAt)
	const day = date.getDate().toString().padStart(2, "0")
	const dow = new Intl.DateTimeFormat("en-US", { weekday: "short" })
		.format(date)
		.toUpperCase()
	const title = entryDisplayTitle(entry)
	const preview = entryPreview(entry)

	return (
		<li
			className={`flex gap-4 py-4 ${last ? "" : "border-b border-[color:var(--ember-divider)]"}`}
		>
			<div className="shrink-0 w-10 text-center pt-0.5">
				<div className="text-xl font-semibold text-[color:var(--ember-ink)] leading-none">
					{day}
				</div>
				<div className="mt-1 text-[11px] tracking-wider text-[color:var(--ember-warm-gray)]">
					{dow}
				</div>
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-base font-semibold text-[color:var(--ember-ink)]">{title}</div>
				{entry.promptText && (
					<div className="mt-0.5 text-sm italic text-[color:var(--ember-warm-gray)]">
						"{entry.promptText}"
					</div>
				)}
				{preview && (
					<p className="mt-1 text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
						{preview}
					</p>
				)}
			</div>
		</li>
	)
}

function CalendarView({ entries }: { entries: JournalEntry[] }) {
	const today = new Date()
	const [cursor, setCursor] = useState({
		year: today.getFullYear(),
		month: today.getMonth(),
	})
	const [selectedDay, setSelectedDay] = useState<number | null>(
		today.getDate(),
	)

	const entriesByDay = useMemo(() => {
		const map = new Map<number, JournalEntry[]>()
		for (const e of entries) {
			const d = new Date(e.createdAt)
			if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month)
				continue
			const key = d.getDate()
			if (!map.has(key)) map.set(key, [])
			map.get(key)?.push(e)
		}
		return map
	}, [entries, cursor])

	const monthLabel = new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(cursor.year, cursor.month, 1))

	const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
	const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
	const cells: Array<number | null> = []
	for (let i = 0; i < firstWeekday; i++) cells.push(null)
	for (let d = 1; d <= daysInMonth; d++) cells.push(d)

	const isToday = (d: number) =>
		d === today.getDate() &&
		cursor.month === today.getMonth() &&
		cursor.year === today.getFullYear()

	const shift = (delta: number) => {
		setCursor((c) => {
			const next = new Date(c.year, c.month + delta, 1)
			return { year: next.getFullYear(), month: next.getMonth() }
		})
		setSelectedDay(null)
	}

	const selectedEntries = selectedDay ? (entriesByDay.get(selectedDay) ?? []) : []
	const selectedDateLabel = selectedDay
		? new Intl.DateTimeFormat("en-US", {
				weekday: "long",
				month: "long",
				day: "numeric",
			}).format(new Date(cursor.year, cursor.month, selectedDay))
		: ""

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<button
					type="button"
					onClick={() => shift(-1)}
					aria-label="Previous month"
					className="p-1 text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-ink)] transition-colors"
				>
					‹
				</button>
				<div className="text-sm font-medium text-[color:var(--ember-ink)]">{monthLabel}</div>
				<button
					type="button"
					onClick={() => shift(1)}
					aria-label="Next month"
					className="p-1 text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-ink)] transition-colors"
				>
					›
				</button>
			</div>

			<div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] tracking-wider text-[color:var(--ember-soft-gray)]">
				{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
					<div key={i}>{d}</div>
				))}
			</div>

			<div className="grid grid-cols-7 gap-1">
				{cells.map((d, i) => {
					if (d === null)
						return <div key={`empty-${i}`} className="aspect-square" />
					const has = entriesByDay.has(d)
					const today_ = isToday(d)
					const selected = d === selectedDay
					return (
						<button
							key={d}
							type="button"
							onClick={() => setSelectedDay(d)}
							aria-label={`${monthLabel} ${d}`}
							aria-pressed={selected}
							className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
								selected
									? "bg-neutral-900 text-white"
									: today_
										? "border-2 border-neutral-900 text-[color:var(--ember-ink)]"
										: has
											? "bg-neutral-100 text-[color:var(--ember-ink)] hover:bg-neutral-200"
											: "text-[color:var(--ember-warm-gray)] hover:bg-[color:var(--ember-cream-light)]"
							}`}
						>
							<span className="leading-none">{d}</span>
							{has && (
								<span
									className={`mt-0.5 block h-1 w-1 rounded-full ${selected ? "bg-[color:var(--ember-card)]" : ""}`}
									style={selected ? undefined : { backgroundColor: "var(--ember-terracotta)" }}
								/>
							)}
						</button>
					)
				})}
			</div>

			<div className="mt-6">
				{selectedDay ? (
					<>
						<h3 className="text-[11px] font-medium tracking-[0.18em] uppercase text-[color:var(--ember-warm-gray)] mb-3">
							{selectedDateLabel}
						</h3>
						{selectedEntries.length > 0 ? (
							<ul className="flex flex-col">
								{selectedEntries.map((entry, idx) => (
									<EntryRow
										key={entry.id}
										entry={entry}
										last={idx === selectedEntries.length - 1}
									/>
								))}
							</ul>
						) : (
							<p className="text-sm text-[color:var(--ember-warm-gray)] py-2">
								Nothing on this day.
							</p>
						)}
					</>
				) : (
					<p className="text-center text-sm text-[color:var(--ember-warm-gray)] py-2">
						Tap a day to see what you wrote.
					</p>
				)}
			</div>
		</div>
	)
}

function MediaView({ entries }: { entries: JournalEntry[] }) {
	const media = entries.filter((e) => e.photoDataUrl || e.audioDataUrl)
	if (media.length === 0) {
		return (
			<p className="text-center text-sm text-[color:var(--ember-warm-gray)] py-12">
				Photos and voice notes show up here.
			</p>
		)
	}
	return (
		<div className="grid grid-cols-2 gap-2">
			{media.map((e) => (
				<div
					key={e.id}
					className="aspect-square rounded-2xl overflow-hidden bg-neutral-100 border border-[color:var(--ember-divider)]"
				>
					{e.photoDataUrl ? (
						<img
							src={e.photoDataUrl}
							alt={e.title || "Entry photo"}
							className="block w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex flex-col items-center justify-center text-[color:var(--ember-warm-gray)]">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="h-8 w-8 mb-2"
								aria-hidden="true"
							>
								<rect x="9" y="3" width="6" height="12" rx="3" />
								<path d="M5 11v1a7 7 0 0 0 14 0v-1" />
								<line x1="12" y1="19" x2="12" y2="22" />
							</svg>
							<span className="text-xs">Voice note</span>
						</div>
					)}
				</div>
			))}
		</div>
	)
}

// ───────── empty state ─────────

function EmptyState() {
	return (
		<div className="rounded-2xl border border-dashed border-[color:var(--ember-divider)] bg-[color:var(--ember-cream-light)] px-6 py-10 text-center">
			<p className="text-base font-medium text-[color:var(--ember-ink)] mb-1">
				Nothing here yet.
			</p>
			<p className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
				Start writing on Today, or tap{" "}
				<span className="font-medium text-[color:var(--ember-warm-gray)]">+ New entry</span>.
			</p>
		</div>
	)
}

// ───────── helpers ─────────

function groupByMonth(entries: JournalEntry[]) {
	const groups = new Map<string, { label: string; entries: JournalEntry[] }>()
	for (const e of entries) {
		const d = new Date(e.createdAt)
		const key = `${d.getFullYear()}-${d.getMonth()}`
		const label = new Intl.DateTimeFormat("en-US", {
			month: "long",
			year: "numeric",
		})
			.format(d)
			.toUpperCase()
		if (!groups.has(key)) groups.set(key, { label, entries: [] })
		groups.get(key)?.entries.push(e)
	}
	return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }))
}
