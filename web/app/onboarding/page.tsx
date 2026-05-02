"use client"

import { useRouter } from "next/navigation"
import { useOnboardingState } from "./_lib/state"

export default function OnboardingPage() {
	const router = useRouter()
	const { update } = useOnboardingState()

	const begin = () => {
		update({ step: "intent" })
		router.push("/onboarding/intent")
	}

	return (
		<main
			className="min-h-dvh w-full flex items-center justify-center p-4 sm:p-8"
			style={{
				backgroundColor: "#FBFAF7",
				backgroundImage:
					"radial-gradient(circle, #D9D5CC 1px, transparent 1px)",
				backgroundSize: "18px 18px",
			}}
		>
			<section
				className="w-full max-w-md min-h-[640px] rounded-3xl flex flex-col px-8 py-12 sm:px-12 sm:py-16"
				style={{ backgroundColor: "#F1ECE2" }}
			>
				<div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-900">
					<h1 className="text-5xl sm:text-6xl font-medium tracking-tight mb-12 lowercase">
						welcome
					</h1>
					<p className="text-lg sm:text-xl leading-relaxed font-light">
						grab a cup of coffee,
						<br />
						take xxx, xxx
						<br />
						it may requiere 10min
						<br />
						so you get a xxx
					</p>
				</div>

				<button
					type="button"
					onClick={begin}
					className="mt-10 w-full rounded-full bg-neutral-900 text-white py-4 text-base font-medium tracking-tight transition-colors hover:bg-neutral-800 active:bg-neutral-700"
				>
					begin
				</button>
			</section>
		</main>
	)
}
