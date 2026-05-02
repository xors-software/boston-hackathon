import { type NextRequest, NextResponse } from "next/server"
import { decryptOAuthPayload, XORS_SESSION_COOKIE } from "@/lib/xors"

// crypto module isn't available in the Edge runtime.
export const runtime = "nodejs"

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export async function GET(request: NextRequest): Promise<NextResponse> {
	const url = new URL(request.url)
	const key = url.searchParams.get("key")
	const nextHint = url.searchParams.get("next_hint")

	// Behind a reverse proxy `request.url` is the internal hostname,
	// not the public origin. Read forwarded headers so emitted
	// redirects target the host the user is on.
	const host =
		request.headers.get("x-forwarded-host") ||
		request.headers.get("host") ||
		url.host
	const protocol =
		request.headers.get("x-forwarded-proto") ||
		url.protocol.replace(/:$/, "")
	const baseUrl = `${protocol}://${host}`

	const loginRedirect = (errorCode: string) => {
		const u = new URL("/login", baseUrl)
		u.searchParams.set("error", errorCode)
		return NextResponse.redirect(u)
	}

	if (!key) return loginRedirect("oauth_no_key")

	let sessionKey: string
	try {
		sessionKey = decryptOAuthPayload(key)
	} catch (err) {
		console.error(
			"[oauth] decrypt failed:",
			err instanceof Error ? err.message : err,
		)
		return loginRedirect("oauth_decrypt")
	}
	if (!sessionKey) return loginRedirect("oauth_empty_key")

	// Same-app paths only — open-redirect guard.
	const baseDest = nextHint && nextHint.startsWith("/") ? nextHint : "/"
	const destUrl = new URL(baseDest, baseUrl)
	destUrl.searchParams.set("signed_in", "google")
	const res = NextResponse.redirect(destUrl)

	const secure = process.env.NODE_ENV === "production"
	res.cookies.set(XORS_SESSION_COOKIE, sessionKey, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: COOKIE_MAX_AGE_SECONDS,
		secure,
	})
	return res
}
