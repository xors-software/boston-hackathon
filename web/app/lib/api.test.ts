import { describe, expect, it } from "vitest"
import { ApiError, unwrap } from "./api"

describe("ApiError", () => {
	it("captures status, message, and body", () => {
		const err = new ApiError(418, "I'm a teapot", { extra: 1 })
		expect(err).toBeInstanceOf(Error)
		expect(err.name).toBe("ApiError")
		expect(err.status).toBe(418)
		expect(err.message).toBe("I'm a teapot")
		expect(err.body).toEqual({ extra: 1 })
	})
})

describe("unwrap", () => {
	it("returns data when the eden result has no error", async () => {
		const result = await unwrap(
			Promise.resolve({ data: { foo: "bar" }, error: null }),
		)
		expect(result).toEqual({ foo: "bar" })
	})

	it("throws ApiError using the body's `error` field", async () => {
		const promise = Promise.resolve({
			data: null,
			error: { status: 404, value: { error: "User not found" } },
		})
		await expect(unwrap(promise)).rejects.toMatchObject({
			name: "ApiError",
			status: 404,
			message: "User not found",
		})
	})

	it("throws ApiError with a generic message when value is unstructured", async () => {
		const promise = Promise.resolve({
			data: null,
			error: { status: 500, value: "kaboom" },
		})
		await expect(unwrap(promise)).rejects.toMatchObject({
			name: "ApiError",
			status: 500,
			message: "Request failed (500)",
		})
	})

	it("throws ApiError(0) when both data and error are null", async () => {
		const promise = Promise.resolve({ data: null, error: null })
		await expect(unwrap(promise)).rejects.toMatchObject({
			name: "ApiError",
			status: 0,
			message: "Empty response",
		})
	})

	it("preserves the raw value as `body` on the thrown error", async () => {
		const value = { error: "nope", details: { code: "E_DENIED" } }
		const promise = Promise.resolve({
			data: null,
			error: { status: 403, value },
		})
		try {
			await unwrap(promise)
			expect.unreachable("unwrap should have thrown")
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError)
			expect((err as ApiError).body).toEqual(value)
		}
	})
})
