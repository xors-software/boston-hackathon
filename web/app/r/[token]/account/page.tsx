"use client"

import { useParams, useRouter } from "next/navigation"
import { type FormEvent, useEffect, useState } from "react"
import { useParentState } from "../_lib/state"

// Backend will pre-fill this from the recipient row keyed by the token.
// Hardcoded for now so the design renders.
const MOCK_PREFILLED_EMAIL = "your.email@example.com"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ParentAccountPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated, markStep, update } = useParentState(token)

	const [email, setEmail] = useState(MOCK_PREFILLED_EMAIL)
	const [password, setPassword] = useState("")
	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (hydrated) markStep("account")
	}, [hydrated])

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.email as string | undefined
		if (saved) setEmail(saved)
	}, [hydrated, state.data.email])

	const emailValid = EMAIL_RE.test(email)
	const passwordValid = password.length >= 8
	const canSubmit = emailValid && passwordValid

	const submit = (e: FormEvent) => {
		e.preventDefault()
		setTouched(true)
		if (!canSubmit) return
		// Don't persist password — backend hashes server-side. Just save email.
		update({ step: "home", data: { email, accountCreated: true } })
		router.push(`/r/${token}/home`)
	}

	return (
		<main
			className="min-h-dvh w-full"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<button
					type="button"
					onClick={() => router.back()}
					className="-ml-1 inline-flex items-center gap-1.5 py-2 text-base transition-opacity hover:opacity-80"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="h-4 w-4"
					>
						<polyline points="15 6 9 12 15 18" />
					</svg>
					<span className="font-serif italic">Back</span>
				</button>

				<header className="mt-6 mb-8">
					<h1
						className="mb-3 font-serif text-[40px] sm:text-[44px] leading-[1.05] tracking-tight"
						style={{ color: "var(--ember-ink)" }}
					>
						Save your{" "}
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							space
						</span>
						.
					</h1>
					<p
						className="text-base leading-relaxed"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						A quick account so you can come back whenever you want, on any
						device. Nothing is shared until you say so.
					</p>
				</header>

				<form onSubmit={submit} className="flex flex-col gap-5" noValidate>
					<label className="flex flex-col gap-2">
						<span
							className="text-[11px] font-medium tracking-[0.22em] uppercase"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							Email
						</span>
						<input
							type="email"
							inputMode="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-2xl px-4 py-3.5 text-base outline-none transition-colors"
							style={{
								backgroundColor: "var(--ember-cream-light)",
								color: "var(--ember-ink)",
								border:
									touched && !emailValid
										? "1px solid var(--ember-terracotta)"
										: "1px solid var(--ember-divider)",
							}}
						/>
						<span
							className="text-xs font-serif italic"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							Pre-filled from the invitation
						</span>
					</label>

					<label className="flex flex-col gap-2">
						<span
							className="text-[11px] font-medium tracking-[0.22em] uppercase"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							Create a password
						</span>
						<input
							type="password"
							autoComplete="new-password"
							placeholder="At least 8 characters"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-2xl px-4 py-3.5 text-base outline-none transition-colors placeholder:italic"
							style={{
								backgroundColor: "var(--ember-cream-light)",
								color: "var(--ember-ink)",
								border:
									touched && !passwordValid
										? "1px solid var(--ember-terracotta)"
										: "1px solid var(--ember-divider)",
							}}
						/>
					</label>

					<button
						type="submit"
						disabled={touched && !canSubmit}
						className="ember-cta ember-cta-with-arrow mt-2"
					>
						<span>Create account</span>
						<span aria-hidden="true" className="ember-cta-arrow">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-4 w-4"
							>
								<line x1="5" y1="12" x2="19" y2="12" />
								<polyline points="13 6 19 12 13 18" />
							</svg>
						</span>
					</button>
				</form>

				<p
					className="mt-6 text-center text-sm font-serif italic"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					By continuing you agree to our{" "}
					<a
						href="#terms"
						className="underline underline-offset-2 hover:opacity-80"
						style={{ color: "var(--ember-terracotta)" }}
					>
						Terms & Privacy
					</a>
					.
				</p>
			</div>
		</main>
	)
}
