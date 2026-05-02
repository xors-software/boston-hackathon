/**
 * XORS centralized identity service integration.
 *
 * Auth happens at api.xors.xyz. The flow mirrors every other consumer
 * app (magister, slopless, contractor-tracker, seeker):
 *
 *   1. Login button → top-level redirect to:
 *        https://api.xors.xyz/authenticate-google?domain=<DOMAIN_KEY>
 *   2. api.xors.xyz handles Google OAuth, finds-or-creates the user in
 *      its own users table, AES-encrypts the user's session key.
 *   3. api.xors.xyz redirects browser back to:
 *        https://<this-app>/oauth?key=<aes-encrypted-hex>
 *   4. /oauth route handler decrypts the key with the shared
 *      API_AES_KEY + API_IV_KEY and sets the `xors_session` HttpOnly cookie.
 *   5. Subsequent authenticated API calls ride the cookie. The backend
 *      forwards the cookie value as `X-API-KEY` to api.xors.xyz/api/users/viewer
 *      to resolve the current user.
 *
 * Crypto byte derivation matches the other consumer apps exactly so a
 * session key minted by api.xors.xyz decrypts identically here:
 *   - API_AES_KEY: utf-8 string used directly as 32-byte AES key
 *   - API_IV_KEY:  base64 → 16-byte AES-CTR IV
 */

import crypto from "node:crypto"

export const XORS_SESSION_COOKIE = "xors_session"

export function getXorsApiUrl(): string {
	return (
		process.env.XORS_API_URL ||
		process.env.NEXT_PUBLIC_XORS_API_URL ||
		"https://api.xors.xyz"
	)
}

// api.xors.xyz tags users with this so it knows which apps a given user
// has signed into. Match the convention used by magister/slopless: the
// consumer app's deployed domain.
export function getXorsAuthSource(): string {
	return process.env.XORS_AUTH_SOURCE || "boston-hackathon.local"
}

// Domain key registered in apis/common/constants.ts (REDIRECT_OPTIONS).
// api.xors.xyz uses this to decide where to bounce the user after Google
// consent. Consumers register their own key — `REDIRECT_BOSTON` is the
// expected value for this app.
export function getOauthDomainKey(): string {
	return process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN || "REDIRECT_BOSTON"
}

/**
 * Build the link the "Sign in with Google" button on /login points at.
 * Server-side helper so the page can render a real `<a href>` instead
 * of going through a fetch — top-level navigation sidesteps the
 * third-party-cookie dance that breaks on Safari/Brave.
 */
export function buildXorsSignInUrl(nextPath?: string): string {
	const base = getXorsApiUrl()
	const domain = getOauthDomainKey()
	const params = new URLSearchParams({ domain })
	if (nextPath) params.set("next_hint", nextPath)
	return `${base}/authenticate-google?${params.toString()}`
}

/**
 * Decrypt the AES-CTR-encrypted session key that api.xors.xyz hands us
 * on the /oauth?key=... callback. Mirrors the encryption in
 * apis/common/server.ts → `encrypt`.
 *
 * Throws if either env var is missing or the input is malformed; callers
 * should treat that as "couldn't sign in" and bounce back to /login.
 */
export function decryptOAuthPayload(hex: string): string {
	const apiAes = process.env.API_AES_KEY
	const apiIv = process.env.API_IV_KEY
	if (!apiAes) throw new Error("API_AES_KEY is not set")
	if (!apiIv) throw new Error("API_IV_KEY is not set")

	const keyBytes = Buffer.from(apiAes, "utf8")
	const ivBytes = Buffer.from(apiIv, "base64")
	const ciphertext = Buffer.from(hex, "hex")
	if (keyBytes.length !== 32) {
		throw new Error(`API_AES_KEY must be 32 utf-8 bytes (got ${keyBytes.length})`)
	}
	if (ivBytes.length !== 16) {
		throw new Error(`API_IV_KEY must decode to 16 bytes (got ${ivBytes.length})`)
	}
	const decipher = crypto.createDecipheriv("aes-256-ctr", keyBytes, ivBytes)
	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
	return decrypted.toString("utf8")
}
