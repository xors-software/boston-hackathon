import crypto from "node:crypto"

export const XORS_SESSION_COOKIE = "xors_session"

export function getXorsApiUrl(): string {
	return (
		process.env.XORS_API_URL ||
		process.env.NEXT_PUBLIC_XORS_API_URL ||
		"https://api.xors.xyz"
	)
}

export function getXorsAuthSource(): string {
	return process.env.XORS_AUTH_SOURCE || "boston-hackathon.local"
}

export function getOauthDomainKey(): string {
	return process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN || "REDIRECT_BOSTON"
}

// Top-level navigation, not fetch — sidesteps the third-party-cookie
// dance that breaks Google OAuth on Safari/Brave.
export function buildXorsSignInUrl(nextPath?: string): string {
	const base = getXorsApiUrl()
	const domain = getOauthDomainKey()
	const params = new URLSearchParams({ domain })
	if (nextPath) params.set("next_hint", nextPath)
	return `${base}/authenticate-google?${params.toString()}`
}

// Decrypts the session key api.xors.xyz returns on the /oauth callback.
// Byte derivation must match every other XORS consumer app exactly
// (see apis/common/server.ts → encrypt) — change here = breaks login
// across all of them.
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
