"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useUser } from "@/hooks/useUser"
import { buildXorsSignInUrl } from "@/lib/xors"
import { useOnboardingState } from "../_lib/state"

export default function AccountPage() {
	const router = useRouter()
	const search = useSearchParams()
	const { state, update, hydrated } = useOnboardingState()
	const { data: user, isLoading } = useUser()

	const justSignedIn = search.get("signed_in") === "google"
	const oauthError = search.get("error")

	useEffect(() => {
		if (!hydrated || !user) return
		update({ data: { email: user.email } })
		// If they already sent, skip onboarding entirely
		if (state.data.sentAt) {
			router.replace("/dashboard")
		}
	}, [hydrated, user, update, state.data.sentAt, router])

	const handleSignIn = () => {
		window.location.href = buildXorsSignInUrl("/onboarding/account")
	}

	const handleContinue = () => {
		update({ step: "recipient" })
		router.push("/onboarding/recipient")
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
						Create your account.
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						Your gift is saved automatically as you build it.
					</p>
				</header>

				{oauthError && !user && (
					<p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						Sign-in didn't complete ({oauthError}). Try again.
					</p>
				)}

				{user ? (
					<div className="flex flex-col gap-5">
						<div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
							<div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">
								Signed in
							</div>
							<div className="text-base font-medium text-neutral-900">
								{user.email || user.displayName || "Your account"}
							</div>
							{justSignedIn && (
								<div className="mt-1 text-sm text-neutral-500">
									Welcome. Let's keep going.
								</div>
							)}
						</div>

						<button
							type="button"
							onClick={handleContinue}
							className="w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
						>
							Continue
						</button>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<button
							type="button"
							onClick={handleSignIn}
							disabled={isLoading}
							className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-60"
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

						<p className="text-center text-sm text-neutral-500">
							We use Google for sign-in. We never post anything.
						</p>
					</div>
				)}
			</div>
		</main>
	)
}
