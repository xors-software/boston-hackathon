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
					className="flex items-center justify-center gap-3 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-muted hover:shadow transition-all"
				>
					<GoogleIcon className="h-5 w-5" />
					<span>Continue with Google</span>
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

function GoogleIcon({ className }: { className?: string }) {
	// Official Google "G" logo. Inline so we don't have to wire it
	// through SVGR — this is the only place we use it.
	return (
		<svg
			className={className}
			viewBox="0 0 48 48"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				fill="#FFC107"
				d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
			/>
			<path
				fill="#FF3D00"
				d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
			/>
			<path
				fill="#4CAF50"
				d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
			/>
			<path
				fill="#1976D2"
				d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
			/>
		</svg>
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
