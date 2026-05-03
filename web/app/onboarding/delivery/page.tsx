"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { EmberListCard } from "@/components/ember/EmberChrome"
import { useOnboardingState } from "../_lib/state"

type DeliveryMethod = "email" | "physical" | "in-person"

type Option = {
	id: DeliveryMethod
	title: string
	subtitle: string
	disabled?: boolean
	badge?: string
}

const OPTIONS: Option[] = [
	{
		id: "email",
		title: "Email",
		subtitle: "A beautifully designed digital invitation.",
	},
	{
		id: "physical",
		title: "Physical letter",
		subtitle: "A real letter we'll mail to them.",
		disabled: true,
		badge: "Coming soon",
	},
	{
		id: "in-person",
		title: "In person",
		subtitle: "A printable card you give them yourself.",
	},
]

export default function DeliveryPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const [selected, setSelected] = useState<DeliveryMethod>("email")

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.delivery
		if (saved === "email" || saved === "in-person") setSelected(saved)
	}, [hydrated, state.data.delivery])

	const select = (id: DeliveryMethod) => {
		const opt = OPTIONS.find((o) => o.id === id)
		if (!opt || opt.disabled) return
		setSelected(id)
	}

	const goNext = () => {
		update({ step: "send", data: { delivery: selected } })
		router.push("/onboarding/send")
	}

	return (
		<main className="min-h-dvh bg-[color:var(--ember-cream)]">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<button
					type="button"
					onClick={() => router.back()}
					className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:text-[color:var(--ember-ink)]"
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

				<header className="mt-6 mb-8">
					<h1 className="mb-3 font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)]">
						How would you like to <span className="italic" style={{ color: "var(--ember-terracotta)" }}>give</span> this gift?
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						You can change your mind before sending.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{OPTIONS.map((opt) => {
						const isSelected = selected === opt.id && !opt.disabled
						return (
							<EmberListCard
								key={opt.id}
								title={opt.title}
								subtitle={opt.subtitle}
								onClick={() => select(opt.id)}
								disabled={opt.disabled}
								right={
									opt.badge ? (
										<span
											className="shrink-0 rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.18em] uppercase"
											style={{
												border: "1px solid var(--ember-divider)",
												color: "var(--ember-warm-gray)",
											}}
										>
											{opt.badge}
										</span>
									) : (
										<span
											className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full"
											style={{
												border: isSelected
													? "1px solid var(--ember-ink)"
													: "1px solid var(--ember-divider)",
												backgroundColor: isSelected
													? "var(--ember-ink)"
													: "transparent",
											}}
										>
											{isSelected && (
												<span className="block h-2 w-2 rounded-full bg-white" />
											)}
										</span>
									)
								}
							/>
						)
					})}
				</div>

				<button
					type="button"
					onClick={goNext}
					className="ember-cta"
				>
					Continue
				</button>
			</div>
		</main>
	)
}
