/**
 * Type-safe API client for the Elysia backend, powered by Eden Treaty.
 *
 * The single `api` export below mirrors the server's route tree exactly
 * — backend renames or signature changes surface as TS errors here
 * with no manual type sync. Usage:
 *
 *   import { api } from "@/lib/api"
 *
 *   const { data, error } = await api.auth.me.get()
 *   const { data, error } = await api.messages.post({
 *     toUserId: "...",
 *     content: "hi",
 *   })
 *
 * Eden returns `{ data, error }` rather than throwing, so every call
 * site is forced to handle the error path. `unwrap()` below is a thin
 * helper for cases where you want a thrown `ApiError` instead (handy
 * inside react-query's `queryFn`).
 */

import { treaty } from "@elysiajs/eden"
import type { App } from "server"

function getBaseUrl(): string {
	// Cross-origin escape hatch — set `NEXT_PUBLIC_API_URL` to hit the
	// Elysia backend directly (mobile clients, alternate deploys). Eden
	// treaty appends route paths (e.g. /auth/me) to whatever we pass
	// here, so we strip any trailing slash.
	const direct = process.env.NEXT_PUBLIC_API_URL
	if (direct) return direct.replace(/\/$/, "")
	// Default: same-origin proxy. The /api prefix matches the rewrite
	// in next.config.js — `/api/auth/me` → `<API_URL>/auth/me`. Bundling
	// `/api` into the base lets treaty's `api.auth.me.get()` resolve to
	// `${origin}/api/auth/me` without any per-call prefix juggling.
	if (typeof window !== "undefined") return `${window.location.origin}/api`
	// SSR/RSC: treaty calls only happen inside react-query's queryFn
	// (client component land), so this branch is mostly defensive.
	return "http://localhost:3000/api"
}

export const api = treaty<App>(getBaseUrl(), {
	fetch: {
		// Cookies (xors_session) ride along with same-origin requests
		// automatically; cross-origin requests need this flag plus a
		// matching `Access-Control-Allow-Credentials` on the server.
		credentials: "include",
	},
})

/**
 * Surface errors from Eden's `{ data, error }` tuple as a thrown
 * `ApiError` — useful inside react-query's `queryFn`/`mutationFn` so
 * the hook lands in the `error` state automatically.
 *
 * Usage:
 *   const { data: messages } = useQuery({
 *     queryKey: ["messages"],
 *     queryFn: () => unwrap(api.messages.get()),
 *   })
 */
export class ApiError extends Error {
	readonly status: number
	readonly body: unknown
	constructor(status: number, message: string, body?: unknown) {
		super(message)
		this.name = "ApiError"
		this.status = status
		this.body = body
	}
}

interface EdenResult<T> {
	data: T | null
	error: { status: number; value: unknown } | null
}

export async function unwrap<T>(promise: Promise<EdenResult<T>>): Promise<T> {
	const { data, error } = await promise
	if (error) {
		const value = error.value
		const message =
			value && typeof value === "object" && "error" in value && typeof (value as { error: unknown }).error === "string"
				? (value as { error: string }).error
				: `Request failed (${error.status})`
		throw new ApiError(error.status, message, value)
	}
	if (data === null) {
		throw new ApiError(0, "Empty response")
	}
	return data
}
