"use client"

import Link from "next/link"
import { useUser } from "@/hooks/useUser"
import { useLogout } from "@/hooks/useMessages"

export function AuthStatus() {
	const { data: user, isLoading } = useUser()
	const logout = useLogout()

	if (isLoading) {
		return (
			<span className="text-sm text-muted-foreground" aria-hidden>
				…
			</span>
		)
	}

	if (!user) {
		return (
			<Link
				href="/login"
				className="text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Sign in
			</Link>
		)
	}

	return (
		<div className="flex items-center gap-3 text-sm">
			<span className="text-muted-foreground">
				Signed in as <span className="text-foreground">{user.displayName ?? user.email}</span>
			</span>
			<button
				type="button"
				onClick={() => logout.mutate()}
				disabled={logout.isPending}
				className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
			>
				{logout.isPending ? "Signing out…" : "Sign out"}
			</button>
		</div>
	)
}
