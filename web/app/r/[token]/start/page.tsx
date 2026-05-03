"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import {
	EmberAccentWord,
	EmberBack,
	EmberContainer,
	EmberEyebrow,
	EmberHeadline,
	EmberPage,
	EmberPrimaryButton,
} from "@/components/ember/EmberChrome"
import { useParentState } from "../_lib/state"

const ITEMS = [
	{
		numeral: "i",
		title: "Write whenever you want",
		body: "Open a blank page and free-write, or pick a prompt to get you started. No schedule, no streak — your pace.",
	},
	{
		numeral: "ii",
		title: "Prompts when you want them",
		body: "Ember offers gentle prompts — some open, some shaped by what you tell it. Use them, ignore them, or write your own.",
	},
	{
		numeral: "iii",
		title: "You decide — nothing leaves without you",
		body: "Keep it for yourself, leave it as something to find later, or share it whenever you want. Nothing is shared until you say so.",
	},
] as const

export default function HowEmberWorksPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { hydrated, markStep, update } = useParentState(token)

	useEffect(() => {
		if (hydrated) markStep("how-it-works")
	}, [hydrated, markStep])

	const handleContinue = () => {
		update({ step: "account" })
		router.push(`/r/${token}/account`)
	}

	return (
		<EmberPage>
			<EmberContainer className="min-h-dvh flex flex-col pt-2 pb-10">
				<EmberBack onClick={() => router.back()} />

				<header className="mt-8 mb-8">
					<EmberEyebrow className="mb-4">HOW EMBER WORKS</EmberEyebrow>
					<EmberHeadline>
						Three things to <EmberAccentWord>know</EmberAccentWord>.
					</EmberHeadline>
				</header>

				<ol className="flex flex-col gap-7 mb-10">
					{ITEMS.map((item) => (
						<li key={item.numeral} className="flex gap-5">
							<span
								className="shrink-0 w-8 font-serif italic text-2xl pt-0.5"
								style={{ color: "var(--ember-terracotta)" }}
							>
								{item.numeral}.
							</span>
							<div className="flex-1 pt-1">
								<h2
									className="text-base font-semibold mb-1"
									style={{ color: "var(--ember-ink)" }}
								>
									{item.title}
								</h2>
								<p
									className="text-[15px] leading-relaxed"
									style={{ color: "var(--ember-warm-gray)" }}
								>
									{item.body}
								</p>
							</div>
						</li>
					))}
				</ol>

				<div className="mt-auto">
					<EmberPrimaryButton onClick={handleContinue}>
						Continue
					</EmberPrimaryButton>
				</div>
			</EmberContainer>
		</EmberPage>
	)
}
