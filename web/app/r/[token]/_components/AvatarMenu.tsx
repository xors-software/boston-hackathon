"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type Props = {
	initial: string
	bg?: string
	border?: boolean
}

export function AvatarMenu({
	initial,
	bg = "var(--ember-soft-gray)",
	border = false,
}: Props) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [signingOut, setSigningOut] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onDocClick = (e: MouseEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", onDocClick)
		return () => document.removeEventListener("mousedown", onDocClick)
	}, [open])

	const signOut = async () => {
		if (signingOut) return
		setSigningOut(true)
		// Best-effort: clear server cookie if present (no-op for parent flow)
		try {
			await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
		} catch {}
		// Clear all parent + onboarding state from this browser
		try {
			const keys: string[] = []
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i)
				if (k && (k.startsWith("ember:parent:") || k === "ember:onboarding:v1"))
					keys.push(k)
			}
			keys.forEach((k) => localStorage.removeItem(k))
		} catch {}
		router.push("/login")
	}

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Account menu"
				className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium text-[color:var(--ember-warm-gray)] transition-colors hover:opacity-90 ${
					border ? "border border-[color:var(--ember-divider)]/60" : ""
				}`}
				style={{ backgroundColor: bg }}
			>
				{initial}
			</button>

			{open && (
				<div
					role="menu"
					className="absolute right-0 mt-2 w-44 rounded-2xl bg-[color:var(--ember-card)] shadow-lg border border-[color:var(--ember-divider)] overflow-hidden z-30"
				>
					<button
						type="button"
						role="menuitem"
						onClick={signOut}
						disabled={signingOut}
						className="w-full text-left px-4 py-3 text-sm text-[color:var(--ember-ink)] hover:bg-[color:var(--ember-cream-light)] transition-colors disabled:opacity-60"
					>
						{signingOut ? "Signing out…" : "Sign out"}
					</button>
				</div>
			)}
		</div>
	)
}
