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
			className="min-h-dvh w-full bg-white"
		>
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
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						{prompt ? "Write about it." : "New entry."}
					</h1>
					<p className="mt-2 text-base text-neutral-500 leading-relaxed">
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
