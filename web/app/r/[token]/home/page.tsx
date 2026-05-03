"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
	EmberAccentWord,
	EmberAppHeader,
	EmberBody,
	EmberContainer,
	EmberEyebrow,
	EmberHeadline,
	EmberListCard,
	EmberPage,
} from "@/components/ember/EmberChrome"
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

function timeOfDayPhrase(d: Date): string {
	const h = d.getHours()
	const month = d.toLocaleString("en-US", { month: "long" }).toUpperCase()
	if (h < 12) return `A MORNING IN ${month}`
	if (h < 17) return `AN AFTERNOON IN ${month}`
	if (h < 21) return `AN EVENING IN ${month}`
	return `A NIGHT IN ${month}`
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
	}, [hydrated, markStep])

	const todayPhrase = timeOfDayPhrase(new Date())
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
		setComposerKey((k) => k + 1)
		setSavedToast(true)
		setTimeout(() => setSavedToast(false), 2000)
	}

	return (
		<EmberPage>
			<EmberContainer className="pt-2 pb-32">
				<EmberAppHeader rightSlot={<AvatarMenu initial={initial} />} />

				<div className="mt-6">
					<EmberEyebrow>{todayPhrase}</EmberEyebrow>
				</div>

				<div className="mt-4">
					<EmberHeadline>
						{archived ? (
							<>Your journal is <EmberAccentWord>kept</EmberAccentWord>.</>
						) : (
							<>
								What do you feel like{" "}
								<EmberAccentWord>writing</EmberAccentWord> today?
							</>
						)}
					</EmberHeadline>

					<EmberBody className="mt-4">
						{archived
							? "It's archived now — read it anytime from the Archive tab."
							: "No prompt, no pressure. The page is here when you are."}
					</EmberBody>
				</div>

				{archived ? (
					<div
						className="mt-8 rounded-2xl px-5 py-5"
						style={{ backgroundColor: "var(--ember-card)" }}
					>
						<button
							type="button"
							onClick={() => router.push(`/r/${token}/journal`)}
							className="font-serif italic text-base inline-flex items-center gap-1.5"
							style={{ color: "var(--ember-terracotta)" }}
						>
							View your journal
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-4 w-4"
								aria-hidden="true"
							>
								<line x1="5" y1="12" x2="19" y2="12" />
								<polyline points="13 6 19 12 13 18" />
							</svg>
						</button>
					</div>
				) : (
					<>
						<div className="mt-8">
							<EntryComposer key={composerKey} onSave={handleSave} />
							<output
								className="mt-3 block text-center font-serif italic text-sm"
								style={{ color: "var(--ember-warm-gray)" }}
							>
								{savedToast
									? "Saved to your journal."
									: "your words, auto-saved as you go"}
							</output>
						</div>

						<div className="mt-10">
							<EmberEyebrow>OR, A WAY IN</EmberEyebrow>
						</div>

						<div className="mt-4 flex flex-col gap-3">
							<EmberListCard
								title="A prompt from the collection"
								subtitle="a small, careful list"
								onClick={() => router.push(`/r/${token}/prompts`)}
							/>
							<EmberListCard
								title="Speak with Ember"
								subtitle="when you'd rather think out loud"
								onClick={() => router.push(`/r/${token}/ai`)}
							/>
							<EmberListCard
								title="Record your voice"
								subtitle="leave it as a voice note"
								onClick={() => router.push(`/r/${token}/voice`)}
							/>
						</div>
					</>
				)}
			</EmberContainer>

			<BottomTabs token={token} active="today" />
		</EmberPage>
	)
}
