"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { routeForStep, useParentState } from "./_lib/state"

// Backend will provide this via GET /r/:token. Hardcoded for now.
const MOCK_GIVER = {
	name: "Sofia",
	pronoun: { subject: "she", possessive: "her", object: "her" },
}

export default function ParentWelcomePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""

	const { state, hydrated, markStep, update } = useParentState(token)

	// Resume — if they've already moved past welcome, jump to where they were
	useEffect(() => {
		if (!hydrated) return
		if (state.step !== "welcome") {
			router.replace(routeForStep(state.step, token))
		}
	}, [hydrated, state.step, token, router])

	useEffect(() => {
		if (hydrated) markStep("welcome")
	}, [hydrated])

	const handleContinue = () => {
		update({ step: "letter" })
		router.push(`/r/${token}/letter`)
	}

	if (!hydrated) return null

	const giver = MOCK_GIVER

	return (
		<main
			className="min-h-dvh w-full flex items-center justify-center px-6 py-10 sm:px-8"
			style={{ backgroundColor: "#F1ECE2" }}
		>
			<div className="w-full max-w-md flex flex-col items-center text-center">
				<p
					className="text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase mb-6"
					style={{ color: "#B8693E" }}
				>
					A gift from {giver.name}
				</p>

				<h1 className="text-4xl sm:text-[44px] font-semibold tracking-tight leading-tight text-neutral-900 mb-6">
					Take your time.
				</h1>

				<p className="text-base sm:text-lg leading-relaxed text-neutral-700 max-w-xs sm:max-w-sm">
					You've just been given a slow gift. There's no timer, no streak, no
					rush.
					<br />
					<br />
					Read what {giver.pronoun.subject} wrote. Then keep reading whenever
					you're ready.
				</p>

				<button
					type="button"
					onClick={handleContinue}
					className="mt-12 text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase text-neutral-500 hover:text-neutral-700 transition-colors"
				>
					Tap to continue ›
				</button>
			</div>
		</main>
	)
}
