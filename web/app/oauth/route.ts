/**
 * OAuth callback handler. api.xors.xyz redirects users here after
 * Google consent with `?key=<aes-encrypted-hex>`. We decrypt the key
 * (which is the user's xors API key), set it as an HttpOnly
 * `xors_session` cookie scoped to this app's domain, and bounce into
 * the app.
 *
 * Failure paths all redirect to /login with an `error` query param so
 * a future login page can surface a hint instead of leaving the user
 * staring at a blank screen.
 */

import { type NextRequest, NextResponse } from "next/server"
import { decryptOAuthPayload, XORS_SESSION_COOKIE } from "@/lib/xors"

// Force the Node runtime — the AES decrypt uses Node's `crypto` module,
// which isn't available in the Edge runtime.
export const runtime = "nodejs"

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export async function GET(request: NextRequest): Promise<NextResponse> {
	const url = new URL(request.url)
	const key = url.searchParams.get("key")
	const nextHint = url.searchParams.get("next_hint")

	// Behind a reverse proxy (Railway, Vercel, etc.), `request.url`
	// reflects the internal hostname rather than the public origin.
	// Read the forwarded headers first so redirects we emit point at
	// the real host the user is on.
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

	// Bounce to the deep-link the user was originally heading for, falling
	// back to the home page. Only allow same-app paths to prevent open
	// redirects.
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
