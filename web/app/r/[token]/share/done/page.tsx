"use client"

import { useParams, useRouter } from "next/navigation"

// Backend: from GET /r/:token. Hardcoded for now.
const MOCK_GIVER = {
	name: "Sofia",
	pronoun: { subject: "she", possessive: "her", object: "her" },
}

function verbHas(pronoun: string): string {
	return pronoun === "they" ? "have" : "has"
}

function verbDoes(pronoun: string): string {
	return pronoun === "they" ? "do" : "does"
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ShareDonePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""

	const giver = MOCK_GIVER
	const subject = giver.pronoun.subject

	return (
		<main
			className="min-h-dvh w-full flex items-center justify-center px-6 py-10 sm:px-8"
			style={{ backgroundColor: "#F1ECE2" }}
		>
			<div className="w-full max-w-md flex flex-col items-center text-center">
				<p
					className="text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase mb-5"
					style={{ color: "#B8693E" }}
				>
					It's on its way
				</p>

				<h1 className="text-4xl sm:text-[44px] font-semibold tracking-tight leading-tight text-neutral-900 mb-5">
					{capitalize(subject)} {verbHas(subject)} it.
				</h1>

				<p className="text-base sm:text-lg leading-relaxed text-neutral-700 max-w-xs sm:max-w-sm">
					{giver.name} will be reading what you wrote.
					<br />
					Whenever {subject} {verbDoes(subject)}, you'll know.
				</p>

				<button
					type="button"
					onClick={() => router.push(`/r/${token}/journal`)}
					className="mt-12 text-base text-neutral-700 underline underline-offset-4 hover:text-neutral-900 transition-colors"
				>
					Back to Today
				</button>
			</div>
		</main>
	)
}
