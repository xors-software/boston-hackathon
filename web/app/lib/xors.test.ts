import crypto from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	buildXorsSignInUrl,
	decryptOAuthPayload,
	getOauthDomainKey,
	getXorsApiUrl,
	getXorsAuthSource,
} from "./xors"

// Fixed key/IV so we can encrypt a known value with the same scheme
// api.xors.xyz uses (apis/common/server.ts → encrypt) and assert
// decrypt gets it back.
const TEST_AES_KEY = "0123456789abcdef0123456789abcdef" // 32 utf-8 bytes
const TEST_IV_BYTES = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex") // 16 bytes
const TEST_IV_BASE64 = TEST_IV_BYTES.toString("base64")

function encryptForTest(plaintext: string): string {
	const cipher = crypto.createCipheriv(
		"aes-256-ctr",
		Buffer.from(TEST_AES_KEY, "utf8"),
		TEST_IV_BYTES,
	)
	return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString(
		"hex",
	)
}

describe("decryptOAuthPayload", () => {
	beforeEach(() => {
		process.env.API_AES_KEY = TEST_AES_KEY
		process.env.API_IV_KEY = TEST_IV_BASE64
	})

	afterEach(() => {
		delete process.env.API_AES_KEY
		delete process.env.API_IV_KEY
	})

	it("round-trips with the byte derivation api.xors.xyz uses", () => {
		const original = "session-key-abc-123"
		const encrypted = encryptForTest(original)
		expect(decryptOAuthPayload(encrypted)).toBe(original)
	})

	it("throws when API_AES_KEY is missing", () => {
		delete process.env.API_AES_KEY
		expect(() => decryptOAuthPayload("deadbeef")).toThrow(/API_AES_KEY/)
	})

	it("throws when API_IV_KEY is missing", () => {
		delete process.env.API_IV_KEY
		expect(() => decryptOAuthPayload("deadbeef")).toThrow(/API_IV_KEY/)
	})

	it("throws when API_AES_KEY is the wrong length", () => {
		process.env.API_AES_KEY = "too-short"
		expect(() => decryptOAuthPayload("deadbeef")).toThrow(/32 utf-8 bytes/)
	})

	it("throws when API_IV_KEY decodes to the wrong length", () => {
		process.env.API_IV_KEY = Buffer.from("short", "utf8").toString("base64")
		expect(() => decryptOAuthPayload("deadbeef")).toThrow(/16 bytes/)
	})
})

describe("buildXorsSignInUrl", () => {
	const ORIGINAL_BASE = process.env.XORS_API_URL
	const ORIGINAL_DOMAIN = process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN

	afterEach(() => {
		if (ORIGINAL_BASE === undefined) delete process.env.XORS_API_URL
		else process.env.XORS_API_URL = ORIGINAL_BASE
		if (ORIGINAL_DOMAIN === undefined)
			delete process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN
		else process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN = ORIGINAL_DOMAIN
	})

	it("builds the default sign-in URL", () => {
		delete process.env.XORS_API_URL
		delete process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN
		expect(buildXorsSignInUrl()).toBe(
			"https://api.xors.xyz/authenticate-google?domain=REDIRECT_BOSTON",
		)
	})

	it("includes a next_hint when provided", () => {
		delete process.env.XORS_API_URL
		delete process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN
		const url = buildXorsSignInUrl("/inbox")
		const u = new URL(url)
		expect(u.pathname).toBe("/authenticate-google")
		expect(u.searchParams.get("domain")).toBe("REDIRECT_BOSTON")
		expect(u.searchParams.get("next_hint")).toBe("/inbox")
	})

	it("respects XORS_API_URL and NEXT_PUBLIC_XORS_OAUTH_DOMAIN overrides", () => {
		process.env.XORS_API_URL = "https://api.example.test"
		process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN = "REDIRECT_OTHER"
		expect(buildXorsSignInUrl()).toBe(
			"https://api.example.test/authenticate-google?domain=REDIRECT_OTHER",
		)
	})
})

describe("env-derived getters", () => {
	const originals = {
		XORS_API_URL: process.env.XORS_API_URL,
		NEXT_PUBLIC_XORS_API_URL: process.env.NEXT_PUBLIC_XORS_API_URL,
		XORS_AUTH_SOURCE: process.env.XORS_AUTH_SOURCE,
		NEXT_PUBLIC_XORS_OAUTH_DOMAIN: process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN,
	}
	afterEach(() => {
		for (const [k, v] of Object.entries(originals)) {
			if (v === undefined) delete process.env[k]
			else process.env[k] = v
		}
	})

	it("getXorsApiUrl prefers XORS_API_URL over NEXT_PUBLIC_XORS_API_URL", () => {
		process.env.XORS_API_URL = "https://server.test"
		process.env.NEXT_PUBLIC_XORS_API_URL = "https://public.test"
		expect(getXorsApiUrl()).toBe("https://server.test")
	})

	it("getXorsApiUrl falls back to NEXT_PUBLIC_XORS_API_URL", () => {
		delete process.env.XORS_API_URL
		process.env.NEXT_PUBLIC_XORS_API_URL = "https://public.test"
		expect(getXorsApiUrl()).toBe("https://public.test")
	})

	it("getXorsApiUrl falls back to api.xors.xyz", () => {
		delete process.env.XORS_API_URL
		delete process.env.NEXT_PUBLIC_XORS_API_URL
		expect(getXorsApiUrl()).toBe("https://api.xors.xyz")
	})

	it("getXorsAuthSource defaults to boston-hackathon.local", () => {
		delete process.env.XORS_AUTH_SOURCE
		expect(getXorsAuthSource()).toBe("boston-hackathon.local")
	})

	it("getOauthDomainKey defaults to REDIRECT_BOSTON", () => {
		delete process.env.NEXT_PUBLIC_XORS_OAUTH_DOMAIN
		expect(getOauthDomainKey()).toBe("REDIRECT_BOSTON")
	})
})
