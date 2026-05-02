"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

const PROVIDER_LABEL: Record<string, string> = {
	google: "Google",
}

function SignedInToastInner() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const provider = searchParams.get("signed_in")
	const fired = useRef(false)

	useEffect(() => {
		if (!provider || fired.current) return
		fired.current = true
		const label = PROVIDER_LABEL[provider] ?? provider
		toast.success(`Signed in with ${label}`)

		// Strip the ?signed_in= flag so a refresh doesn't re-fire the
		// toast. router.replace keeps history clean.
		const params = new URLSearchParams(searchParams.toString())
		params.delete("signed_in")
		const qs = params.toString()
		router.replace(qs ? `?${qs}` : "?", { scroll: false })
	}, [provider, router, searchParams])

	return null
}

export function SignedInToast() {
	// useSearchParams suspends during prerender — wrap so the host
	// page can stay statically optimized.
	return (
		<Suspense fallback={null}>
			<SignedInToastInner />
		</Suspense>
	)
}
