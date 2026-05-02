"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components"
import { useLogin } from "@/hooks/useLogin"
import { useUser } from "@/hooks/useUser"
import { ApiError } from "@/lib/api"
import { buildXorsSignInUrl } from "@/lib/xors"

const ERROR_MESSAGES: Record<string, string> = {
	oauth_no_key: "Sign-in didn't return a session key. Please try again.",
	oauth_decrypt: "Couldn't decrypt the sign-in token. Server config issue.",
	oauth_empty_key: "Sign-in returned an empty session. Please try again.",
}

function LoginPageInner() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const errorCode = searchParams.get("error")
	const nextHint = searchParams.get("next") ?? "/"

	const { data: user, isLoading } = useUser()
	const login = useLogin()

	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")

	// Already signed in → bounce to home (or the deep-link).
	if (!isLoading && user) {
		if (typeof window !== "undefined") router.replace(nextHint)
		return null
	}

	const submitting = login.isPending
	const errorMessage =
		(login.error instanceof ApiError && login.error.message) ||
		(errorCode && ERROR_MESSAGES[errorCode]) ||
		(errorCode ? `Sign-in failed (${errorCode}).` : null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		try {
			await login.mutateAsync({ email, password })
			router.replace(nextHint)
		} catch {
			// Error surfaces via login.error / errorMessage above.
		}
	}

	return (
		<main className="min-h-dvh flex items-center justify-center bg-background px-6 py-12">
			<div className="w-full max-w-sm space-y-6">
				<header className="text-center space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
					<p className="text-sm text-muted-foreground">
						Use your XORS account to continue.
					</p>
				</header>

				<a
					href={buildXorsSignInUrl(nextHint)}
					className="flex items-center justify-center gap-2 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
				>
					Continue with Google
				</a>

				<div className="relative flex items-center">
					<div className="flex-1 border-t border-border" />
					<span className="px-3 text-xs uppercase text-muted-foreground">
						or
					</span>
					<div className="flex-1 border-t border-border" />
				</div>

				<form className="space-y-3" onSubmit={handleSubmit}>
					<div className="space-y-1">
						<label
							htmlFor="email"
							className="block text-xs font-medium text-muted-foreground"
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={submitting}
							className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
						/>
					</div>
					<div className="space-y-1">
						<label
							htmlFor="password"
							className="block text-xs font-medium text-muted-foreground"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={submitting}
							className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
						/>
					</div>

					{errorMessage && (
						<p className="text-sm text-red-600" role="alert">
							{errorMessage}
						</p>
					)}

					<Button
						type="submit"
						variant="default"
						size="large"
						className="w-full"
						disabled={submitting || !email || !password}
					>
						{submitting ? "Signing in…" : "Sign in"}
					</Button>
				</form>

				<p className="text-center text-xs text-muted-foreground">
					New here? Signing in with an unknown email creates an account
					automatically.
				</p>
			</div>
		</main>
	)
}

export default function LoginPage() {
	// useSearchParams suspends during prerender — wrap so the page can
	// be statically optimized with a placeholder fallback.
	return (
		<Suspense fallback={<main className="min-h-dvh bg-background" />}>
			<LoginPageInner />
		</Suspense>
	)
}
