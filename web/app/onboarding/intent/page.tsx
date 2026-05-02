"use client"

import { useRouter } from "next/navigation"
import { useOnboardingState } from "../_lib/state"

const OPTIONS = [
	{ id: "mom", title: "My mom", subtitle: "Most common starting point" },
	{ id: "dad", title: "My dad", subtitle: "The questions adapt" },
	{
		id: "loved-one",
		title: "Someone I love",
		subtitle: "Partner, grandparent, friend",
	},
	{
		id: "undecided",
		title: "I'm not sure yet",
		subtitle: "Explore first, decide later",
	},
] as const

export default function IntentPage() {
	const router = useRouter()
	const { update } = useOnboardingState()

	const select = (id: string) => {
		update({ step: "account", data: { intent: id } })
		router.push("/onboarding/account")
	}

	return (
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-14 pb-12 sm:px-8">
				<header className="mb-8">
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight text-neutral-900 leading-tight mb-3">
						Who are you here for?
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						Ember is a slow gift. Start by telling us who you're thinking of.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{OPTIONS.map((opt) => (
						<button
							key={opt.id}
							type="button"
							onClick={() => select(opt.id)}
							className="group w-full flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100"
						>
							<div className="min-w-0">
								<div className="text-base font-semibold text-neutral-900">
									{opt.title}
								</div>
								<div className="mt-0.5 text-sm text-neutral-500">
									{opt.subtitle}
								</div>
							</div>
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-5 w-5 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-600"
							>
								<polyline points="9 6 15 12 9 18" />
							</svg>
						</button>
					))}
				</div>
			</div>
		</main>
	)
}
