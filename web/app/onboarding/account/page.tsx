"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useEffect, useState } from "react"
import { useLogin } from "@/hooks/useLogin"
import { useUser } from "@/hooks/useUser"
import { ApiError } from "@/lib/api"
import { buildXorsSignInUrl } from "@/lib/xors"
import { useOnboardingState } from "../_lib/state"
import { useEnsureGift } from "../_lib/sync"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AccountPage() {
	const router = useRouter()
	const search = useSearchParams()
	const { state, update, hydrated } = useOnboardingState()
	const { data: user, isLoading } = useUser()
	const login = useLogin()
	useEnsureGift(hydrated ? state : null)

	const justSignedIn = search.get("signed_in") === "google"
	const oauthError = search.get("error")

	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [touched, setTouched] = useState(false)

	useEffect(() => {
		if (!hydrated || !user) return
		if (state.data.sentAt) {
			router.replace("/dashboard")
		}
	}, [hydrated, user, state.data.sentAt, router])

	const handleSignIn = () => {
		window.location.href = buildXorsSignInUrl("/onboarding/account")
	}

	const handleContinue = () => {
		update({ step: "recipient" })
		router.push("/onboarding/recipient")
	}

	const emailValid = EMAIL_RE.test(email)
	const passwordValid = password.length >= 8
	const canSubmit = emailValid && passwordValid && !login.isPending

	const submitEmail = async (e: FormEvent) => {
		e.preventDefault()
		setTouched(true)
		if (!canSubmit) return
		try {
			await login.mutateAsync({ email, password })
			// useUser will refetch and surface the signed-in state on next render
		} catch {
			// Error surfaces via login.error below
		}
	}

	const loginError =
		login.error instanceof ApiError ? login.error.message : null

	return (
		<main className="min-h-dvh bg-[color:var(--ember-card)]">
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
						Create your{" "}
						<span
							className="italic"
							style={{ color: "var(--ember-terracotta)" }}
						>
							account
						</span>
						.
					</h1>
					<p
						className="text-base leading-relaxed"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Your gift is saved automatically as you build it.
					</p>
				</header>

				{oauthError && !user && (
					<p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						Sign-in didn't complete ({oauthError}). Try again.
					</p>
				)}

				{user ? (
					<div className="flex flex-col gap-5">
						<div className="rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-cream-light)] px-5 py-4">
							<div
								className="text-[10px] font-medium tracking-[0.22em] uppercase mb-1"
								style={{ color: "var(--ember-warm-gray)" }}
							>
								Signed in
							</div>
							<div
								className="text-base font-medium"
								style={{ color: "var(--ember-ink)" }}
							>
								{user.email || user.displayName || "Your account"}
							</div>
							{justSignedIn && (
								<div
									className="mt-1 text-sm font-serif italic"
									style={{ color: "var(--ember-warm-gray)" }}
								>
									Welcome. Let's keep going.
								</div>
							)}
						</div>

						<button
							type="button"
							onClick={handleContinue}
							className="ember-cta ember-cta-with-arrow"
						>
							<span>Continue</span>
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
					</div>
				) : (
					<div className="flex flex-col gap-5">
						<button
							type="button"
							onClick={handleSignIn}
							disabled={isLoading}
							className="ember-cta"
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								className="h-5 w-5"
							>
								<path
									fill="#fff"
									d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.886-1.737 2.986-4.295 2.986-7.351z"
								/>
								<path
									fill="#fff"
									opacity=".8"
									d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.227-2.51c-.895.6-2.04.954-3.391.954-2.604 0-4.81-1.759-5.595-4.122H3.073v2.59A9.998 9.998 0 0 0 12 22z"
								/>
								<path
									fill="#fff"
									opacity=".6"
									d="M6.405 13.9a6.013 6.013 0 0 1 0-3.8V7.51H3.073a10.005 10.005 0 0 0 0 8.98l3.332-2.59z"
								/>
								<path
									fill="#fff"
									opacity=".4"
									d="M12 5.977c1.468 0 2.786.504 3.823 1.495l2.866-2.867C16.96 3.05 14.696 2 12 2 8.094 2 4.72 4.236 3.073 7.51l3.332 2.59C7.19 7.736 9.396 5.977 12 5.977z"
								/>
							</svg>
							Continue with Google
						</button>

						<div className="flex items-center gap-3">
							<div
								className="h-px flex-1"
								style={{ backgroundColor: "var(--ember-divider)" }}
							/>
							<span
								className="font-serif italic text-sm"
								style={{ color: "var(--ember-warm-gray)" }}
							>
								or
							</span>
							<div
								className="h-px flex-1"
								style={{ backgroundColor: "var(--ember-divider)" }}
							/>
						</div>

						<form
							onSubmit={submitEmail}
							className="flex flex-col gap-4"
							noValidate
						>
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
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="w-full rounded-2xl px-4 py-3.5 text-base outline-none transition-colors placeholder:italic"
									style={{
										backgroundColor: "var(--ember-cream-light)",
										color: "var(--ember-ink)",
										border:
											touched && !emailValid
												? "1px solid var(--ember-terracotta)"
												: "1px solid var(--ember-divider)",
									}}
								/>
							</label>

							<label className="flex flex-col gap-2">
								<span
									className="text-[11px] font-medium tracking-[0.22em] uppercase"
									style={{ color: "var(--ember-warm-gray)" }}
								>
									Password
								</span>
								<input
									type="password"
									autoComplete="current-password"
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

							{loginError && (
								<p
									className="text-sm"
									style={{ color: "var(--ember-terracotta)" }}
									role="alert"
								>
									{loginError}
								</p>
							)}

							<button
								type="submit"
								disabled={touched && !canSubmit}
								className="ember-cta ember-cta-with-arrow"
							>
								<span>
									{login.isPending
										? "Signing in…"
										: "Continue with email"}
								</span>
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
							className="text-center text-sm font-serif italic"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							New here? Signing in with an unknown email creates an account
							automatically.
						</p>
					</div>
				)}
			</div>
		</main>
	)
}
