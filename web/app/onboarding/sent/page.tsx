"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useOnboardingState } from "../_lib/state"

const SUBJECT: Record<string, string> = {
	mom: "she",
	dad: "he",
	"loved-one": "they",
	undecided: "they",
}

export default function SentPage() {
	const router = useRouter()
	const { state } = useOnboardingState()
	const [copied, setCopied] = useState(false)

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const subject = SUBJECT[intent] ?? "they"
	const token = state.data.recipientToken as string | undefined
	const recipientLink =
		token && typeof window !== "undefined"
			? `${window.location.origin}/r/${token}`
			: null

	const copyLink = async () => {
		if (!recipientLink) return
		try {
			await navigator.clipboard.writeText(recipientLink)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {}
	}

	return (
		<main className="min-h-dvh bg-white flex flex-col">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8 flex-1 flex flex-col">
				<button
					type="button"
					onClick={() => router.back()}
					className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-neutral-700 transition-colors hover:text-neutral-900"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="h-4 w-4"
					>
						<polyline points="15 6 9 12 15 18" />
					</svg>
					Back
				</button>

				<div className="flex-1 flex flex-col items-center justify-center text-center px-2">
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900 mb-4">
						It's on its way.
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed mb-10">
						You'll hear back when {subject} opens it.
					</p>

					{recipientLink && (
						<div className="w-full mb-10 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-left">
							<div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
								Recipient link (also delivered by email — backup copy)
							</div>
							<div className="break-all text-sm text-neutral-800 font-mono">
								{recipientLink}
							</div>
							<button
								type="button"
								onClick={copyLink}
								className="mt-3 text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors"
							>
								{copied ? "Copied" : "Copy link"}
							</button>
						</div>
					)}

					<button
						type="button"
						onClick={() => router.push("/dashboard")}
						className="inline-flex items-center gap-1 text-base text-neutral-900 underline underline-offset-2 hover:text-neutral-700 transition-colors"
					>
						Go to dashboard <span aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		</main>
	)
}
