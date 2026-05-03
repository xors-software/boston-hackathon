"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { EmberTextArea } from "@/components/ember/EmberTextArea"
import { useOnboardingState } from "../_lib/state"

const MAX_CHARS = 800

export default function WhyPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const [why, setWhy] = useState("")

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.why
		if (typeof saved === "string") setWhy(saved)
	}, [hydrated, state.data.why])

	const goNext = () => {
		update({ step: "world", data: { why } })
		router.push("/onboarding/world")
	}

	const goSkip = () => {
		update({ step: "world" })
		router.push("/onboarding/world")
	}

	const goAiHelp = () => {
		update({ data: { why } })
		router.push("/onboarding/why/ai")
	}

	return (
		<main className="min-h-dvh bg-[color:var(--ember-cream)]">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => router.back()}
						className="-ml-1 inline-flex items-center gap-1.5 py-2 text-base transition-opacity hover:opacity-80"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-4 w-4"
						>
							<polyline points="15 6 9 12 15 18" />
						</svg>
						<span className="font-serif italic">Back</span>
					</button>
					<button
						type="button"
						onClick={goSkip}
						className="py-2 text-base font-serif italic transition-opacity hover:opacity-80"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Skip
					</button>
				</div>

				<header className="mt-6 mb-8">
					<h1
						className="mb-3 font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05]"
						style={{ color: "var(--ember-ink)" }}
					>
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							Why
						</span>{" "}
						do you want to make this for them?
					</h1>
					<p
						className="text-base leading-relaxed"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						This stays private to you. It helps us shape the experience.
					</p>
				</header>

				<EmberTextArea
					value={why}
					onChange={setWhy}
					placeholder="Start typing"
					max={MAX_CHARS}
					rows={8}
				/>

				<p
					className="mt-4 flex items-start gap-1.5 text-sm font-serif italic"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						className="mt-0.5 h-4 w-4 shrink-0"
					>
						<circle cx="12" cy="12" r="9" />
						<line x1="12" y1="11" x2="12" y2="16" strokeLinecap="round" />
						<circle cx="12" cy="8" r="0.6" fill="currentColor" />
					</svg>
					<span>
						Personalizes their prompts and the gift letter. Never shared with
						them.
					</span>
				</p>

				<div className="mt-6 flex flex-col gap-3">
					<button type="button" onClick={goNext} className="ember-cta">
						Continue
					</button>

					<button
						type="button"
						onClick={goAiHelp}
						className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 text-base font-serif italic transition-opacity hover:opacity-80"
						style={{
							backgroundColor: "transparent",
							color: "var(--ember-ink)",
							border: "1px solid var(--ember-divider)",
						}}
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="h-4 w-4"
							style={{ color: "var(--ember-terracotta)" }}
						>
							<path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
						</svg>
						Brainstorm with Ember
					</button>
				</div>

				<div className="mt-5 text-center">
					<button
						type="button"
						onClick={goSkip}
						className="text-sm font-serif italic underline underline-offset-2 transition-opacity hover:opacity-80"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Skip for now
					</button>
				</div>
			</div>
		</main>
	)
}
