"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import {
	EntryComposer,
	type EntryDraft,
} from "../../_components/EntryComposer"
import { type JournalEntry, newEntryId } from "../../_lib/entries"
import { findPrompt } from "../../_lib/prompts"
import { isArchived } from "../../_lib/sharing"
import { useParentState } from "../../_lib/state"

export default function NewEntryPage() {
	const router = useRouter()
	const params = useParams()
	const search = useSearchParams()
	const token = (params.token as string) ?? ""
	const promptId = search.get("promptId") ?? undefined
	const prompt = promptId ? findPrompt(promptId) : undefined

	const { state, hydrated, update } = useParentState(token)

	useEffect(() => {
		if (hydrated && isArchived(state.data)) {
			router.replace(`/r/${token}/journal`)
		}
	}, [hydrated, state.data, router, token])

	const handleSave = (draft: EntryDraft) => {
		const entries =
			(state.data.entries as JournalEntry[] | undefined) ?? []
		const entry: JournalEntry = {
			id: newEntryId(),
			createdAt: new Date().toISOString(),
			...draft,
			promptText: draft.promptText ?? prompt?.text,
			promptId: draft.promptId ?? prompt?.id,
		}
		update({ data: { entries: [entry, ...entries] } })
		router.push(`/r/${token}/journal`)
	}

	return (
		<main
			className="min-h-dvh w-full bg-[color:var(--ember-card)]"
		>
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
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
					<h1 className="font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)]">
						{prompt ? (
							<>
								<span
									className="italic"
									style={{ color: "var(--ember-terracotta)" }}
								>
									Write
								</span>{" "}
								about it.
							</>
						) : (
							<>
								New{" "}
								<span
									className="italic"
									style={{ color: "var(--ember-terracotta)" }}
								>
									entry
								</span>
								.
							</>
						)}
					</h1>
					<p className="mt-2 text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Text, voice, photo — whatever feels right.
					</p>
				</header>

				<EntryComposer
					autoFocus
					promptId={prompt?.id}
					promptText={prompt?.text}
					onSave={handleSave}
					onCancel={() => router.back()}
				/>
			</div>
		</main>
	)
}
