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
			style={{ backgroundColor: "#F1ECE2" }}
		>
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
						Save your space.
					</h1>
					<p className="text-base text-neutral-600 leading-relaxed">
						A quick account so you can come back whenever you want, on any
						device. Nothing is shared until you say so.
					</p>
				</header>

				<form onSubmit={submit} className="flex flex-col gap-5" noValidate>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-neutral-800">Email</span>
						<input
							type="email"
							inputMode="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={`w-full rounded-xl border bg-white px-4 py-3.5 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-900 ${
								touched && !emailValid
									? "border-red-400"
									: "border-neutral-200"
							}`}
						/>
						<span className="text-xs text-neutral-500">
							Pre-filled from the invitation
						</span>
					</label>

					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-neutral-800">
							Create a password
						</span>
						<input
							type="password"
							autoComplete="new-password"
							placeholder="At least 8 characters"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={`w-full rounded-xl border bg-white px-4 py-3.5 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-900 ${
								touched && !passwordValid
									? "border-red-400"
									: "border-neutral-200"
							}`}
						/>
					</label>

					<button
						type="submit"
						disabled={touched && !canSubmit}
						className="mt-2 w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Create account
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-neutral-500">
					By continuing you agree to our{" "}
					<a
						href="#terms"
						className="underline underline-offset-2 hover:text-neutral-700"
					>
						Terms & Privacy
					</a>
					.
				</p>
			</div>
		</main>
	)
}
