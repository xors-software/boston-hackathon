"use client"

import { useRouter } from "next/navigation"
import { EmberListCard } from "@/components/ember/EmberChrome"
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
		<main className="min-h-dvh bg-[color:var(--ember-cream)]">
			<div className="mx-auto w-full max-w-md px-6 pt-14 pb-12 sm:px-8">
				<header className="mb-8">
					<h1 className="font-serif text-[40px] sm:text-[44px] tracking-tight text-[color:var(--ember-ink)] leading-[1.05] mb-3">
						Who are you{" "}
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							here
						</span>{" "}
						for?
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Ember is a slow gift. Start by telling us who you're thinking of.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{OPTIONS.map((opt) => (
						<EmberListCard
							key={opt.id}
							title={opt.title}
							subtitle={opt.subtitle}
							onClick={() => select(opt.id)}
						/>
					))}
				</div>
			</div>
		</main>
	)
}
