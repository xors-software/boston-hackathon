import { describe, expect, it } from "bun:test"
import { bucketFor, createInMemoryStorage, keyFor } from "./storage"

describe("storage / in-memory fake", () => {
	it("put then get round-trips bytes", async () => {
		const s = createInMemoryStorage()
		const body = new TextEncoder().encode("hello")
		const put = await s.put({
			bucket: "ember",
			key: "r-audio/g/q/1.wav",
			body,
		})
		expect(put.url).toBe("memory://ember/ember/r-audio/g/q/1.wav")

		const got = await s.get("ember", "r-audio/g/q/1.wav")
		expect(got).not.toBeNull()
		if (!got) throw new Error("unreachable")
		expect(new TextDecoder().decode(got.body)).toBe("hello")
	})

	it("get returns null for missing keys", async () => {
		const s = createInMemoryStorage()
		expect(await s.get("ember", "missing")).toBeNull()
	})

	it("_dump enumerates everything stored", async () => {
		const s = createInMemoryStorage()
		await s.put({
			bucket: "ember",
			key: "a",
			body: new Uint8Array([1, 2, 3]),
		})
		await s.put({
			bucket: "ember",
			key: "b",
			body: new Uint8Array([4]),
		})
		const dump = s._dump()
		expect(dump).toHaveLength(2)
		expect(dump.find((d) => d.key === "a")?.size).toBe(3)
		expect(dump.find((d) => d.key === "b")?.size).toBe(1)
	})

	it("keyFor produces a path with prefix/giftId/questionId/<ts>.<ext>", () => {
		const k = keyFor("r-audio", {
			giftId: "gft_x",
			questionId: "qst_y",
			ext: "wav",
		})
		expect(k).toMatch(/^r-audio\/gft_x\/qst_y\/\d+\.wav$/)
	})

	it("bucketFor honors S3_BUCKET env, falls back to ember", () => {
		const prev = process.env.S3_BUCKET
		try {
			delete process.env.S3_BUCKET
			expect(bucketFor("r-audio")).toBe("ember")
			process.env.S3_BUCKET = "ember-prod"
			expect(bucketFor("r-photos")).toBe("ember-prod")
		} finally {
			if (prev === undefined) delete process.env.S3_BUCKET
			else process.env.S3_BUCKET = prev
		}
	})
})
