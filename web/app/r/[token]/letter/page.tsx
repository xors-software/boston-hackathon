"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useParentState } from "../_lib/state"

// Backend will return this from GET /r/:token. Hardcoded for now.
const MOCK = {
	giverName: "Sofia",
	recipientName: "Mom",
	personalMessage: null as string | null,
}

const GENERIC_LETTER = `I've been wanting to ask you things for years. Not the easy things — the ones I never get around to over Sunday calls.

So I made you a quiet space. The app will gently nudge you sometimes — little prompts, not from me, just sparks to write around. You don't owe me an answer to any of them. You don't owe me anything.

Write, talk, send a photo. Whatever feels right. Whenever it feels right.

It's all yours. Keep it for yourself, leave it as something to find later, or share it with me whenever you decide — today, in five years, or never.`

export default function ParentLetterPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { hydrated, markStep, update } = useParentState(token)

	useEffect(() => {
		if (hydrated) markStep("letter")
	}, [hydrated, markStep])

	const message = MOCK.personalMessage?.trim() || GENERIC_LETTER
	const paragraphs = message
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean)

	const handleContinue = () => {
		update({ step: "how-it-works" })
		router.push(`/r/${token}/start`)
	}

	return (
		<main
			className="min-h-dvh w-full flex flex-col"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="flex-1 overflow-y-auto px-6 pt-12 pb-32 sm:px-8">
				<article
					className="mx-auto w-full max-w-md font-serif"
					style={{ color: "var(--ember-ink)" }}
				>
					<p className="text-2xl sm:text-[28px] italic mb-6">
						{MOCK.recipientName},
					</p>

					<div className="flex flex-col gap-5 text-lg sm:text-[19px] leading-[1.65]">
						{paragraphs.map((p, i) => (
							<p key={i}>{p}</p>
						))}
					</div>

					<p
						className="mt-10 text-lg italic"
						style={{ color: "var(--ember-terracotta)" }}
					>
						— {MOCK.giverName}
					</p>
				</article>
			</div>

			<div
				className="sticky bottom-0 left-0 right-0"
				style={{ backgroundColor: "var(--ember-cream)" }}
			>
				<div
					aria-hidden="true"
					className="h-px w-full"
					style={{ backgroundColor: "var(--ember-divider)" }}
				/>
				<div className="mx-auto w-full max-w-md px-6 py-4 sm:px-8 flex items-center justify-between">
					<span
						className="text-[11px] font-medium tracking-[0.22em] uppercase"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Page 1 of 1
					</span>
					<button
						type="button"
						onClick={handleContinue}
						className="group relative inline-flex items-center justify-center rounded-full pl-5 pr-12 py-3 text-sm font-medium text-white transition-colors"
						style={{ backgroundColor: "var(--ember-ink)" }}
					>
						<span>Continue</span>
						<span
							aria-hidden="true"
							className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full"
							style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-3.5 w-3.5"
							>
								<line x1="5" y1="12" x2="19" y2="12" />
								<polyline points="13 6 19 12 13 18" />
							</svg>
						</span>
					</button>
				</div>
			</div>
		</main>
	)
}
