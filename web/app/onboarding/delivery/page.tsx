"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
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

				<header className="mt-6 mb-8">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						How would you like to give this gift?
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						You can change your mind before sending.
					</p>
				</header>

				<div className="flex flex-col gap-3">
					{OPTIONS.map((opt) => {
						const isSelected = selected === opt.id && !opt.disabled
						return (
							<button
								key={opt.id}
								type="button"
								onClick={() => select(opt.id)}
								disabled={opt.disabled}
								aria-pressed={isSelected}
								className={`w-full text-left rounded-2xl border bg-white px-5 py-4 transition-colors ${
									opt.disabled
										? "border-neutral-200 cursor-not-allowed opacity-60"
										: isSelected
											? "border-neutral-900"
											: "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
								}`}
							>
								<div className="flex items-center justify-between gap-4">
									<div className="min-w-0">
										<div className="text-base font-semibold text-neutral-900">
											{opt.title}
										</div>
										<div className="mt-0.5 text-sm text-neutral-500">
											{opt.subtitle}
										</div>
									</div>
									{opt.badge ? (
										<span className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
											{opt.badge}
										</span>
									) : (
										<span
											className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border ${
												isSelected
													? "border-neutral-900 bg-neutral-900"
													: "border-neutral-300 bg-white"
											}`}
										>
											{isSelected && (
												<span className="block h-2 w-2 rounded-full bg-white" />
											)}
										</span>
									)}
								</div>
							</button>
						)
					})}
				</div>

				<button
					type="button"
					onClick={goNext}
					className="mt-8 w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
				>
					Continue
				</button>
			</div>
		</main>
	)
}
