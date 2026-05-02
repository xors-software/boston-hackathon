"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useOnboardingState } from "../../_lib/state"
import { QUESTION_LIBRARY } from "../_lib/library"

type CustomQuestion = {
	id: string
	text: string
	photoUrl?: string
	preface?: string
}

type QuestionsState = {
	selectedIds: string[]
	custom: CustomQuestion[]
	edits?: Record<string, string>
}

const LIBRARY_MAP = new Map(QUESTION_LIBRARY.map((q) => [q.id, q]))

export default function ReviewQuestionsPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [custom, setCustom] = useState<CustomQuestion[]>([])
	const [edits, setEdits] = useState<Record<string, string>>({})
	const [editingId, setEditingId] = useState<string | null>(null)
	const [draftText, setDraftText] = useState("")

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.questions as QuestionsState | undefined
		if (saved?.selectedIds) setSelectedIds(saved.selectedIds)
		if (saved?.custom) setCustom(saved.custom)
		if (saved?.edits) setEdits(saved.edits)
	}, [hydrated, state.data.questions])

	const customMap = useMemo(
		() => new Map(custom.map((c) => [c.id, c])),
		[custom],
	)

	const persist = (next: Partial<QuestionsState>) => {
		const merged: QuestionsState = {
			selectedIds: next.selectedIds ?? selectedIds,
			custom: next.custom ?? custom,
			edits: next.edits ?? edits,
		}
		if (next.selectedIds) setSelectedIds(next.selectedIds)
		if (next.custom) setCustom(next.custom)
		if (next.edits) setEdits(next.edits)
		update({ data: { questions: merged } })
	}

	const getQuestion = (id: string) => {
		const customQ = customMap.get(id)
		const libQ = LIBRARY_MAP.get(id)
		const baseText = customQ?.text ?? libQ?.text ?? "(missing question)"
		return {
			id,
			text: edits[id] ?? baseText,
			isCustom: Boolean(customQ),
			photoUrl: customQ?.photoUrl,
		}
	}

	const items = selectedIds.map(getQuestion)

	const remove = (id: string) => {
		const nextSelected = selectedIds.filter((x) => x !== id)
		const nextEdits = { ...edits }
		delete nextEdits[id]
		const nextCustom = custom.filter((c) => c.id !== id)
		persist({
			selectedIds: nextSelected,
			edits: nextEdits,
			custom: nextCustom,
		})
		if (editingId === id) {
			setEditingId(null)
			setDraftText("")
		}
	}

	const startEdit = (id: string, currentText: string) => {
		setEditingId(id)
		setDraftText(currentText)
	}

	const cancelEdit = () => {
		setEditingId(null)
		setDraftText("")
	}

	const saveEdit = (e: FormEvent) => {
		e.preventDefault()
		if (!editingId) return
		const trimmed = draftText.trim()
		if (!trimmed) return

		const target = customMap.get(editingId)
		if (target) {
			const nextCustom = custom.map((c) =>
				c.id === editingId ? { ...c, text: trimmed } : c,
			)
			const nextEdits = { ...edits }
			delete nextEdits[editingId]
			persist({ custom: nextCustom, edits: nextEdits })
		} else {
			const lib = LIBRARY_MAP.get(editingId)
			if (lib && lib.text === trimmed) {
				const nextEdits = { ...edits }
				delete nextEdits[editingId]
				persist({ edits: nextEdits })
			} else {
				persist({ edits: { ...edits, [editingId]: trimmed } })
			}
		}

		setEditingId(null)
		setDraftText("")
	}

	const goAddMore = () => {
		router.push("/onboarding/questions")
	}

	const goContinue = () => {
		update({ step: "delivery" })
		router.push("/onboarding/delivery")
	}

	return (
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<button
					type="button"
					onClick={() => router.back()}
					className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-neutral-700 transition-colors hover:text-neutral-900"
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
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						Your questions.
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						Edit or remove. {items.length} selected.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{items.map((item, idx) =>
						editingId === item.id ? (
							<form
								key={item.id}
								onSubmit={saveEdit}
								className="rounded-2xl border border-neutral-300 bg-white px-5 py-4"
							>
								<div className="flex items-start gap-3">
									<span className="text-sm text-neutral-400 pt-2.5 shrink-0">
										{idx + 1}.
									</span>
									<textarea
										value={draftText}
										onChange={(e) => setDraftText(e.target.value)}
										autoFocus
										rows={3}
										className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-neutral-900 transition-colors"
									/>
								</div>
								<div className="mt-3 flex items-center justify-end gap-3">
									<button
										type="button"
										onClick={cancelEdit}
										className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={!draftText.trim()}
										className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Save
									</button>
								</div>
							</form>
						) : (
							<div
								key={item.id}
								className="rounded-2xl border border-neutral-200 bg-white px-5 py-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex-1 min-w-0 flex items-start gap-3">
										<span className="text-sm text-neutral-400 pt-0.5 shrink-0">
											{idx + 1}.
										</span>
										<span className="text-base text-neutral-900 leading-snug">
											{item.text}
											{item.photoUrl && (
												<span className="text-neutral-500"> — with photo</span>
											)}
										</span>
									</div>
									<div className="flex items-center gap-2 text-sm text-neutral-400 shrink-0">
										<button
											type="button"
											onClick={() => startEdit(item.id, item.text)}
											className="hover:text-neutral-700 transition-colors"
										>
											edit
										</button>
										<span aria-hidden="true">·</span>
										<button
											type="button"
											onClick={() => remove(item.id)}
											aria-label="Remove question"
											className="hover:text-neutral-700 transition-colors"
										>
											×
										</button>
									</div>
								</div>
							</div>
						),
					)}

					{items.length === 0 && (
						<p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-6 text-center text-sm text-neutral-500">
							Nothing selected yet. Tap "Add more" to pick some questions.
						</p>
					)}
				</div>

				<div className="mt-8 flex gap-3">
					<button
						type="button"
						onClick={goAddMore}
						className="flex-1 rounded-2xl border border-neutral-200 bg-white py-4 text-base font-medium text-neutral-900 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
					>
						+ Add more
					</button>
					<button
						type="button"
						onClick={goContinue}
						disabled={items.length === 0}
						className="flex-1 rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Continue to send
					</button>
				</div>
			</div>
		</main>
	)
}
