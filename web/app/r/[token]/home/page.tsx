"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AvatarMenu } from "../_components/AvatarMenu"
import { BottomTabs } from "../_components/BottomTabs"
import {
	EntryComposer,
	type EntryDraft,
} from "../_components/EntryComposer"
import { type JournalEntry, newEntryId } from "../_lib/entries"
import { isArchived } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

const MOCK_RECIPIENT = { name: "Mom" }

function formatDate(d: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	})
		.format(d)
		.toUpperCase()
}

export default function ParentHomePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated, markStep, update } = useParentState(token)

	const [savedToast, setSavedToast] = useState(false)
	const [composerKey, setComposerKey] = useState(0)

	useEffect(() => {
		if (hydrated) markStep("home")
	}, [hydrated])

	const today = formatDate(new Date())
	const entries = (state.data.entries as JournalEntry[] | undefined) ?? []
	const initial =
		(state.data.email as string | undefined)?.[0]?.toUpperCase() ??
		MOCK_RECIPIENT.name[0]

	const archived = hydrated && isArchived(state.data)

	const handleSave = (draft: EntryDraft) => {
		const entry: JournalEntry = {
			id: newEntryId(),
			createdAt: new Date().toISOString(),
			...draft,
		}
		update({ data: { entries: [entry, ...entries] } })
		setComposerKey((k) => k + 1) // remount composer to clear inputs
		setSavedToast(true)
		setTimeout(() => setSavedToast(false), 2000)
	}

	return (
		<main
			className="min-h-dvh w-full"
			style={{ backgroundColor: "#F1ECE2" }}
		>
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-32 sm:px-8">
				<div className="flex items-center justify-end">
					<AvatarMenu initial={initial} />
				</div>

				<div className="mt-10">
					<p className="text-[11px] font-medium tracking-[0.18em] uppercase text-neutral-500 mb-3">
						{today}
					</p>
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-snug text-neutral-900">
						{archived
							? "Your journal is shared."
							: "What do you feel like writing today?"}
					</h1>
				</div>

				{archived ? (
					<div className="mt-6 rounded-2xl bg-white px-5 py-5">
						<p className="text-base text-neutral-700 leading-relaxed">
							You shared your journal. It's archived now — view it anytime from
							the Journal tab.
						</p>
						<button
							type="button"
							onClick={() => router.push(`/r/${token}/journal`)}
							className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700 transition-colors"
						>
							View your journal <span aria-hidden="true">→</span>
						</button>
					</div>
				) : (
					<>
						<div className="mt-6">
							<EntryComposer key={composerKey} onSave={handleSave} />
						</div>

						{savedToast && (
							<p
								className="mt-3 text-sm"
								style={{ color: "#B8693E" }}
								role="status"
							>
								Saved to your journal.
							</p>
						)}

						<p className="mt-10 text-[11px] font-medium tracking-[0.18em] uppercase text-neutral-500 mb-3">
							Or, if you'd like a starting point
						</p>

						<div className="flex flex-col gap-2">
					<StartingPointCard
						onClick={() => router.push(`/r/${token}/prompts`)}
						label="Pick a prompt"
						icon={
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="h-5 w-5"
							>
								<path d="M7 6c-2 0-3.5 1.5-3.5 3.5S5 13 7 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C10.5 7.5 9 6 7 6zm10 0c-2 0-3.5 1.5-3.5 3.5S15 13 17 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C20.5 7.5 19 6 17 6z" />
							</svg>
						}
					/>
					<StartingPointCard
						onClick={() => router.push(`/r/${token}/ai`)}
						label="Talk it through with Ember"
						icon={
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="h-5 w-5"
							>
								<path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
							</svg>
						}
					/>
					<StartingPointCard
						onClick={() => router.push(`/r/${token}/voice`)}
						label="Record your voice"
						icon={
							<span
								className="block h-3 w-3 rounded-full"
								style={{ backgroundColor: "#B8693E" }}
							/>
						}
					/>
						</div>
					</>
				)}
			</div>

			<BottomTabs token={token} active="today" />
		</main>
	)
}

function StartingPointCard({
	icon,
	label,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100"
		>
			<div className="flex items-center gap-3 min-w-0">
				<span
					className="shrink-0 flex h-6 w-6 items-center justify-center"
					style={{ color: "#B8693E" }}
				>
					{icon}
				</span>
				<span className="text-base text-neutral-900">{label}</span>
			</div>
			<span className="text-neutral-400 text-base shrink-0" aria-hidden="true">
				›
			</span>
		</button>
	)
}
