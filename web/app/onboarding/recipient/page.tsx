"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { EmberTextArea } from "@/components/ember/EmberTextArea"
import { useOnboardingState } from "../_lib/state"

const MAX_CHARS = 500

export default function RecipientPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const [about, setAbout] = useState("")

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.about
		if (typeof saved === "string") setAbout(saved)
	}, [hydrated, state.data.about])

	const goNext = () => {
		update({ step: "why", data: { about } })
		router.push("/onboarding/why")
	}

	const goSkip = () => {
		update({ step: "why" })
		router.push("/onboarding/why")
	}

	const goAiHelp = () => {
		update({ data: { about } })
		router.push("/onboarding/recipient/ai")
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
						Tell us a little about{" "}
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							them
						</span>
						.
					</h1>
					<p
						className="text-base leading-relaxed"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						A phrase they say. A way they laugh. Something only you'd know.
					</p>
				</header>

				<EmberTextArea
					value={about}
					onChange={setAbout}
					placeholder="Start typing"
					max={MAX_CHARS}
					rows={6}
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
					<span>This personalizes their questions. Never shared with them.</span>
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
						Let's talk with Ember to help me
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
