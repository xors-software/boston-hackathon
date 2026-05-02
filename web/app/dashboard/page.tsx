"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useOnboardingState } from "../onboarding/_lib/state"

const RECIPIENT_DEFAULTS: Record<
	string,
	{ name: string; subject: string; possessive: string }
> = {
	mom: { name: "Mom", subject: "her", possessive: "her" },
	dad: { name: "Dad", subject: "him", possessive: "his" },
	"loved-one": { name: "Them", subject: "them", possessive: "their" },
	undecided: { name: "Them", subject: "them", possessive: "their" },
}

type QuestionsState = {
	selectedIds: string[]
	custom: unknown[]
	edits?: Record<string, string>
}

function formatDate(iso: string): string {
	try {
		const d = new Date(iso)
		return new Intl.DateTimeFormat(undefined, {
			month: "long",
			day: "numeric",
		}).format(d)
	} catch {
		return ""
	}
}

export default function DashboardPage() {
	const router = useRouter()
	const { state, hydrated } = useOnboardingState()

	const [redirected, setRedirected] = useState(false)

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const labels = RECIPIENT_DEFAULTS[intent] ?? RECIPIENT_DEFAULTS["loved-one"]

	const recipientName =
		(state.data.recipientName as string | undefined) || labels.name
	const sentAt = state.data.sentAt as string | undefined
	const delivery =
		(state.data.delivery as "email" | "in-person" | undefined) ?? "email"
	const deliveryLabel = delivery === "email" ? "Email" : "In person"
	const questions = state.data.questions as QuestionsState | undefined
	const sentCount = questions?.selectedIds.length ?? 0

	// If user lands here without having sent, bounce them back into onboarding
	useEffect(() => {
		if (!hydrated || redirected) return
		if (!sentAt) {
			setRedirected(true)
			router.replace("/onboarding")
		}
	}, [hydrated, sentAt, router, redirected])

	if (!hydrated || !sentAt) return null

	return (
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-10 pb-12 sm:px-8">
				<header className="mb-8">
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900 mb-2">
						For {recipientName}.
					</h1>
					<p className="text-sm text-neutral-500">
						Sent {formatDate(sentAt)} · {deliveryLabel}
					</p>
				</header>

				<div className="flex flex-col gap-3">
					<DashCard label="Status" value={`Awaiting ${labels.possessive} first response`} />

					<DashCard
						label="Questions"
						value={`${sentCount} sent`}
						hint="add more anytime"
					/>

					<button
						type="button"
						onClick={() => router.push("/onboarding/questions/write")}
						className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-base font-medium text-neutral-900 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
					>
						+ Add a question
					</button>
				</div>

				<div className="mt-8 text-center text-sm text-neutral-500">
					<a
						href="#settings"
						className="underline underline-offset-2 hover:text-neutral-700 transition-colors"
					>
						Settings
					</a>
					<span className="mx-2" aria-hidden="true">·</span>
					<a
						href="#help"
						className="underline underline-offset-2 hover:text-neutral-700 transition-colors"
					>
						Help
					</a>
				</div>
			</div>
		</main>
	)
}

function DashCard({
	label,
	value,
	hint,
}: {
	label: string
	value: string
	hint?: string
}) {
	return (
		<div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4">
			<div className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 mb-1">
				{label}
			</div>
			<div className="text-base text-neutral-900">
				<span className="font-semibold">{value}</span>
				{hint && <span className="text-neutral-500"> · {hint}</span>}
			</div>
		</div>
	)
}
