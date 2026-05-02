"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useParentState } from "../_lib/state"

const ITEMS = [
	{
		title: "Write whenever you want",
		body: "Open a blank page and free-write, or pick a prompt to get you started. No schedule, no streak — your pace.",
	},
	{
		title: "Prompts when you want them",
		body: "Ember offers gentle prompts — some open, some shaped by what you tell it. Use them, ignore them, or write your own.",
	},
	{
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
	}, [hydrated])

	const handleContinue = () => {
		update({ step: "account" })
		router.push(`/r/${token}/account`)
	}

	return (
		<main
			className="min-h-dvh w-full flex flex-col"
			style={{ backgroundColor: "#F1ECE2" }}
		>
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

				<header className="mt-8 mb-8">
					<p
						className="text-[11px] font-medium tracking-[0.22em] uppercase mb-2"
						style={{ color: "#B8693E" }}
					>
						How Ember works
					</p>
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						Three things to know.
					</h1>
				</header>

				<ol className="flex flex-col gap-6 mb-10">
					{ITEMS.map((item, i) => (
						<li key={i} className="flex gap-4">
							<div
								className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px]"
								style={{ borderColor: "#B8693E", color: "#B8693E" }}
							>
								<span className="text-base font-medium">{i + 1}</span>
							</div>
							<div className="flex-1 pt-0.5">
								<h2 className="text-base font-semibold text-neutral-900 mb-1">
									{item.title}
								</h2>
								<p className="text-[15px] text-neutral-600 leading-relaxed">
									{item.body}
								</p>
							</div>
						</li>
					))}
				</ol>

				<div className="mt-auto">
					<button
						type="button"
						onClick={handleContinue}
						className="w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
					>
						Continue
					</button>
				</div>
			</div>
		</main>
	)
}
