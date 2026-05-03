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
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="w-full max-w-md flex flex-col items-center text-center">
				<p
					className="text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase mb-5"
					style={{ color: "var(--ember-terracotta)" }}
				>
					It's on its way
				</p>

				<h1
					className="font-serif text-[44px] sm:text-[56px] leading-[1.05] tracking-tight mb-5"
					style={{ color: "var(--ember-ink)" }}
				>
					{capitalize(subject)} {verbHas(subject)}{" "}
					<span
						className="italic"
						style={{ color: "var(--ember-terracotta)" }}
					>
						it
					</span>
					.
				</h1>

				<p
					className="text-base sm:text-lg leading-relaxed max-w-xs sm:max-w-sm"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					{giver.name} will be reading what you wrote.
					<br />
					Whenever {subject} {verbDoes(subject)}, you'll know.
				</p>

				<button
					type="button"
					onClick={() => router.push(`/r/${token}/journal`)}
					className="mt-12 font-serif italic text-base underline underline-offset-4 transition-opacity hover:opacity-80"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					Back to Today
				</button>
			</div>
		</main>
	)
}
