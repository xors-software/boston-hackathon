"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import {
	EmberAccentWord,
	EmberEyebrow,
	EmberPage,
} from "@/components/ember/EmberChrome"
import { routeForStep, useParentState } from "./_lib/state"

const MOCK_GIVER = {
	name: "Sofia",
	pronoun: { subject: "she", possessive: "her", object: "her" },
}

export default function ParentWelcomePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""

	const { state, hydrated, markStep, update } = useParentState(token)

	useEffect(() => {
		if (!hydrated) return
		if (state.step !== "welcome") {
			router.replace(routeForStep(state.step, token))
		}
	}, [hydrated, state.step, token, router])

	useEffect(() => {
		if (hydrated) markStep("welcome")
	}, [hydrated, markStep])

	const handleContinue = () => {
		update({ step: "letter" })
		router.push(`/r/${token}/letter`)
	}

	if (!hydrated) return null

	const giver = MOCK_GIVER

	return (
		<EmberPage>
			<div className="min-h-dvh w-full flex items-center justify-center px-6 py-10 sm:px-8">
				<div className="w-full max-w-md flex flex-col items-center text-center">
					<EmberEyebrow className="mb-6 justify-center">
						A GIFT FROM {giver.name.toUpperCase()}
					</EmberEyebrow>

					<h1
						className="font-serif text-[44px] sm:text-[56px] leading-[1.05] tracking-tight mb-6"
						style={{ color: "var(--ember-ink)" }}
					>
						Take your <EmberAccentWord>time</EmberAccentWord>.
					</h1>

					<p
						className="text-base sm:text-lg leading-relaxed max-w-xs sm:max-w-sm"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						You've just been given a slow gift. There's no timer, no streak,
						no rush.
						<br />
						<br />
						Read what {giver.pronoun.subject} wrote. Then keep reading
						whenever you're ready.
					</p>

					<button
						type="button"
						onClick={handleContinue}
						className="mt-12 text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase transition-opacity hover:opacity-80"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Tap to continue ›
					</button>
				</div>
			</div>
		</EmberPage>
	)
}
