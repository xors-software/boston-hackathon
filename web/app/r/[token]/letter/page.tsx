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
	}, [hydrated])

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
			style={{ backgroundColor: "#F1ECE2" }}
		>
			<div className="flex-1 overflow-y-auto px-6 pt-12 pb-32 sm:px-8">
				<article className="mx-auto w-full max-w-md font-serif text-neutral-900">
					<p className="text-2xl sm:text-[26px] mb-6">{MOCK.recipientName},</p>

					<div className="flex flex-col gap-5 text-base sm:text-lg leading-relaxed">
						{paragraphs.map((p, i) => (
							<p key={i}>{p}</p>
						))}
					</div>

					<p className="mt-8 text-base sm:text-lg italic text-neutral-700">
						— {MOCK.giverName}
					</p>
				</article>
			</div>

			<div
				className="sticky bottom-0 left-0 right-0 border-t border-neutral-300/60"
				style={{ backgroundColor: "#F1ECE2" }}
			>
				<div className="mx-auto w-full max-w-md px-6 py-4 sm:px-8 flex items-center justify-between">
					<span className="text-[11px] font-medium tracking-[0.18em] uppercase text-neutral-500">
						Page 1 of 1
					</span>
					<button
						type="button"
						onClick={handleContinue}
						className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
					>
						Continue <span aria-hidden="true">›</span>
					</button>
				</div>
			</div>
		</main>
	)
}
