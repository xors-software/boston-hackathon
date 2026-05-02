import { treaty } from "@elysiajs/eden"
import type { App } from "server"

function getBaseUrl(): string {
	const direct = process.env.NEXT_PUBLIC_API_URL
	if (direct) return direct.replace(/\/$/, "")
	// Bundling /api into the base matches the next.config.js rewrite
	// so same-origin requests carry the xors_session cookie under
	// SameSite=Lax (cross-site fails on Safari/Brave).
	if (typeof window !== "undefined") return `${window.location.origin}/api`
	return "http://localhost:3000/api"
}

export const api = treaty<App>(getBaseUrl(), {
	fetch: { credentials: "include" },
})

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

// Eden returns { data, error } rather than throwing. unwrap() converts
// to a thrown ApiError so it lands in react-query's error state.
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
