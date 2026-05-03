"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiError, api, unwrap } from "@/lib/api"
import { getStoredGiftId } from "../_lib/sync"
import { useOnboardingState } from "../_lib/state"
import {
	CATEGORY_TABS,
	QUESTION_LIBRARY,
	type LibraryQuestion,
	type QuestionCategory,
} from "./_lib/library"

const MIN_SELECTED = 3

const RECIPIENT_PHRASE: Record<string, string> = {
	mom: "your mom",
	dad: "your dad",
	"loved-one": "your loved one",
	undecided: "the person you're thinking of",
}

type CategoryFilter = "suggested" | "personalized" | QuestionCategory

type CustomQuestion = {
	id: string
	text: string
	photoUrl?: string
	preface?: string
}

type AiQuestion = {
	id: string
	text: string
}

type QuestionsState = {
	selectedIds: string[]
	custom: CustomQuestion[]
	ai?: AiQuestion[]
}

const SUGGESTED_COUNT = QUESTION_LIBRARY.filter((q) => q.suggested).length

const PERSONALIZED_TAB = { id: "personalized" as const, label: "Personalized" }

const TAB_ORDER = [
	CATEGORY_TABS[0], // Suggested
	PERSONALIZED_TAB,
	...CATEGORY_TABS.slice(1),
]

type FetchState = "idle" | "loading" | "ready" | "empty" | "auth" | "error"

export default function QuestionsPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const recipientPhrase = RECIPIENT_PHRASE[intent] ?? "them"

	const [filter, setFilter] = useState<CategoryFilter>("suggested")
	const [search, setSearch] = useState("")
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [custom, setCustom] = useState<CustomQuestion[]>([])
	const [aiPicks, setAiPicks] = useState<AiQuestion[]>([])
	const [aiSuggestions, setAiSuggestions] = useState<AiQuestion[]>([])
	const [aiState, setAiState] = useState<FetchState>("idle")
	const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null)

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.questions as QuestionsState | undefined
		if (saved?.selectedIds) setSelectedIds(saved.selectedIds)
		if (saved?.custom) setCustom(saved.custom)
		if (saved?.ai) setAiPicks(saved.ai)
	}, [hydrated, state.data.questions])

	const fetchSuggestions = useCallback(async () => {
		const giftId = getStoredGiftId()
		if (!giftId) {
			setAiState("auth")
			return
		}
		setAiState("loading")
		setAiErrorMsg(null)
		try {
			const result = await unwrap(
				api
					.gifts({ id: giftId })
					["suggest-questions"]
					.post(),
			)
			const list = result.suggestions ?? []
			setAiSuggestions(list)
			setAiState(list.length === 0 ? "empty" : "ready")
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				setAiState("auth")
			} else {
				setAiState("error")
				setAiErrorMsg(
					err instanceof Error ? err.message : "Couldn't load suggestions",
				)
			}
		}
	}, [])

	useEffect(() => {
		if (filter !== "personalized") return
		if (aiState !== "idle") return
		void fetchSuggestions()
	}, [filter, aiState, fetchSuggestions])

	const allQuestions = useMemo<LibraryQuestion[]>(() => {
		const customAsLibrary: LibraryQuestion[] = custom.map((c) => ({
			id: c.id,
			text: c.text,
			categories: [],
			suggested: true,
		}))
		return [...customAsLibrary, ...QUESTION_LIBRARY]
	}, [custom])

	const aiPickedById = useMemo(
		() => new Map(aiPicks.map((q) => [q.id, q])),
		[aiPicks],
	)

	const aiVisible = useMemo<LibraryQuestion[]>(() => {
		const merged = new Map<string, AiQuestion>()
		for (const q of aiPicks) merged.set(q.id, q)
		for (const q of aiSuggestions) if (!merged.has(q.id)) merged.set(q.id, q)
		return Array.from(merged.values()).map((q) => ({
			id: q.id,
			text: q.text,
			categories: [],
			suggested: true,
		}))
	}, [aiPicks, aiSuggestions])

	const visibleQuestions = useMemo(() => {
		const q = search.trim().toLowerCase()
		if (q) {
			return [...aiVisible, ...allQuestions].filter((item) =>
				item.text.toLowerCase().includes(q),
			)
		}
		if (filter === "personalized") {
			return aiVisible
		}
		if (filter === "suggested") {
			return allQuestions.filter((item) => item.suggested)
		}
		return allQuestions.filter((item) =>
			item.categories.includes(filter as QuestionCategory),
		)
	}, [allQuestions, aiVisible, filter, search])

	const persistAll = (next: {
		selectedIds?: string[]
		ai?: AiQuestion[]
	}) => {
		const merged: QuestionsState = {
			selectedIds: next.selectedIds ?? selectedIds,
			custom,
			ai: next.ai ?? aiPicks,
		}
		if (next.selectedIds) setSelectedIds(next.selectedIds)
		if (next.ai) setAiPicks(next.ai)
		update({ data: { questions: merged } })
	}

	const toggle = (id: string) => {
		const isSelected = selectedIds.includes(id)
		const nextSelected = isSelected
			? selectedIds.filter((x) => x !== id)
			: [...selectedIds, id]

		const fromSuggestions = aiSuggestions.find((q) => q.id === id)
		const fromPicks = aiPickedById.get(id)
		let nextAi: AiQuestion[] | undefined
		if (isSelected && fromPicks) {
			nextAi = aiPicks.filter((q) => q.id !== id)
		} else if (!isSelected && fromSuggestions && !fromPicks) {
			nextAi = [...aiPicks, fromSuggestions]
		}
		persistAll({ selectedIds: nextSelected, ai: nextAi })
	}

	const goReview = () => {
		if (selectedIds.length < MIN_SELECTED) return
		router.push("/onboarding/questions/review")
	}

	const goWriteOwn = () => {
		router.push("/onboarding/questions/write")
	}

	return (
		<main className="min-h-dvh bg-[color:var(--ember-cream)]">
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

				<header className="mt-6 mb-6">
					<h1 className="mb-3 font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)]">
						Build the{" "}
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							questions
						</span>
						.
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Suggested for {recipientPhrase}, based on what you told us.
					</p>
				</header>

				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search questions..."
					className="w-full rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-4 py-3 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
				/>

				<div className="mt-4 -mx-6 sm:-mx-8 px-6 sm:px-8 overflow-x-auto no-scrollbar">
					<div className="flex flex-wrap gap-2">
						{TAB_ORDER.map((tab) => {
							const isActive = filter === tab.id && !search
							let count: number | null = null
							if (tab.id === "suggested") count = SUGGESTED_COUNT + custom.length
							else if (tab.id === "personalized" && aiState === "ready")
								count = aiVisible.length
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => {
										setSearch("")
										setFilter(tab.id)
									}}
									className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
										isActive
											? "border-neutral-900 bg-[color:var(--ember-ink)] text-white"
											: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] text-[color:var(--ember-warm-gray)] hover:border-neutral-400"
									}`}
								>
									{tab.label}
									{count != null && (
										<span
											className={`ml-1.5 ${isActive ? "text-white/80" : "text-[color:var(--ember-soft-gray)]"}`}
										>
											{count}
										</span>
									)}
								</button>
							)
						})}
					</div>
				</div>

				{filter === "personalized" && !search && (
					<PersonalizedStatus
						state={aiState}
						errorMsg={aiErrorMsg}
						onRetry={() => {
							setAiState("idle")
						}}
					/>
				)}

				<div className="mt-5 flex flex-col gap-2">
					{visibleQuestions.map((q) => {
						const isSelected = selectedIds.includes(q.id)
						return (
							<button
								key={q.id}
								type="button"
								onClick={() => toggle(q.id)}
								aria-pressed={isSelected}
								className={`w-full text-left rounded-2xl border bg-[color:var(--ember-card)] px-5 py-4 transition-colors ${
									isSelected
										? "border-neutral-900"
										: "border-[color:var(--ember-divider)] hover:border-[color:var(--ember-divider)] hover:bg-[color:var(--ember-cream-light)]"
								}`}
							>
								<div className="flex items-center justify-between gap-3">
									<span className="text-base text-[color:var(--ember-ink)] leading-snug">
										{q.text}
									</span>
									<span
										className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
											isSelected
												? "border-neutral-900 bg-[color:var(--ember-ink)] text-white"
												: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] text-[color:var(--ember-soft-gray)]"
										}`}
									>
										{isSelected ? (
											<svg
												aria-hidden="true"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="h-3.5 w-3.5"
											>
												<polyline points="20 6 9 17 4 12" />
											</svg>
										) : (
											<svg
												aria-hidden="true"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="h-3.5 w-3.5"
											>
												<line x1="12" y1="5" x2="12" y2="19" />
												<line x1="5" y1="12" x2="19" y2="12" />
											</svg>
										)}
									</span>
								</div>
							</button>
						)
					})}

					{visibleQuestions.length === 0 && (
						<p className="px-1 py-6 text-sm text-[color:var(--ember-warm-gray)]">
							No questions match. Try a different search or write your own.
						</p>
					)}

					<button
						type="button"
						onClick={goWriteOwn}
						className="mt-2 w-full rounded-2xl border border-dashed border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] px-5 py-4 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:border-neutral-400 hover:bg-[color:var(--ember-cream-light)]"
					>
						+ Write your own question
					</button>
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 bg-[color:var(--ember-card)] border-t border-[color:var(--ember-divider)]">
				<div className="mx-auto w-full max-w-md px-6 py-4 sm:px-8 flex items-center justify-between">
					<span className="text-sm text-[color:var(--ember-warm-gray)]">
						<span className="font-semibold">{selectedIds.length} selected</span>
						<span className="text-[color:var(--ember-warm-gray)]"> · {MIN_SELECTED} minimum</span>
					</span>
					<button
						type="button"
						onClick={goReview}
						disabled={selectedIds.length < MIN_SELECTED}
						className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--ember-ink)] underline underline-offset-2 transition-colors hover:text-[color:var(--ember-warm-gray)] disabled:text-[color:var(--ember-soft-gray)] disabled:no-underline"
					>
						Review <span aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		</main>
	)
}

function PersonalizedStatus({
	state,
	errorMsg,
	onRetry,
}: {
	state: FetchState
	errorMsg: string | null
	onRetry: () => void
}) {
	if (state === "loading") {
		return (
			<p className="mt-4 px-1 text-sm text-neutral-500">
				Reading what you shared and writing a few suggestions...
			</p>
		)
	}
	if (state === "auth") {
		return (
			<p className="mt-4 px-1 text-sm text-neutral-500">
				Sign in earlier in the flow to get personalized questions here.
			</p>
		)
	}
	if (state === "empty") {
		return (
			<p className="mt-4 px-1 text-sm text-neutral-500">
				Nothing yet — try filling out the About and Why steps first.
			</p>
		)
	}
	if (state === "error") {
		return (
			<div className="mt-4 px-1 text-sm text-neutral-500">
				<span>{errorMsg ?? "Couldn't load suggestions."} </span>
				<button
					type="button"
					onClick={onRetry}
					className="underline underline-offset-2 text-neutral-700 hover:text-neutral-900"
				>
					Try again
				</button>
			</div>
		)
	}
	return null
}
