// Storage abstraction for question + recipient uploads (audio + photos).
//
// The route code always calls `storage.put(...)` and gets back a stable
// URL. The active backend is selected from env at boot:
//   memory (default) — in-process, lost on restart, fine for dev/test
//   s3              — any S3-compatible endpoint (Railway / R2 / AWS),
//                     via Bun's built-in S3Client (no extra deps)

export interface PutInput {
	bucket: string
	key: string
	body: ArrayBuffer | Uint8Array
	contentType?: string
}

export interface PutResult {
	url: string
	bucket: string
	key: string
}

export interface Storage {
	put(input: PutInput): Promise<PutResult>
	// Retrieval is read-only and used only by the in-memory fake's
	// tests today; S3 reads happen through the URL the caller stored.
	get?(bucket: string, key: string): Promise<{ body: Uint8Array } | null>
}

export interface InMemoryStorage extends Storage {
	get(bucket: string, key: string): Promise<{ body: Uint8Array } | null>
	// Test helper — dump everything stored so far.
	_dump(): Array<{ bucket: string; key: string; size: number }>
	_clear(): void
}

export function createInMemoryStorage(
	urlBase = "memory://ember",
): InMemoryStorage {
	const blobs = new Map<string, { body: Uint8Array; contentType?: string }>()
	const k = (bucket: string, key: string) => `${bucket}/${key}`

	return {
		async put({ bucket, key, body, contentType }) {
			const bytes =
				body instanceof Uint8Array ? body : new Uint8Array(body as ArrayBuffer)
			blobs.set(k(bucket, key), { body: bytes, contentType })
			return {
				url: `${urlBase}/${bucket}/${key}`,
				bucket,
				key,
			}
		},
		async get(bucket, key) {
			const v = blobs.get(k(bucket, key))
			if (!v) return null
			return { body: v.body }
		},
		_dump() {
			return Array.from(blobs.entries()).map(([id, v]) => {
				const [bucket, ...rest] = id.split("/")
				return { bucket, key: rest.join("/"), size: v.body.length }
			})
		},
		_clear() {
			blobs.clear()
		},
	}
}

// S3 backend via Bun's native S3Client. Works against any S3-compatible
// endpoint (Railway, R2, AWS, MinIO) — no AWS SDK install required.
async function createS3Storage(): Promise<Storage> {
	const accessKeyId = process.env.S3_ACCESS_KEY_ID
	const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
	const region = process.env.S3_REGION ?? "auto"
	const endpoint = process.env.S3_ENDPOINT
	if (!accessKeyId || !secretAccessKey) {
		throw new Error(
			"S3 backend requested but S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY missing",
		)
	}
	const { S3Client } = await import("bun")
	return {
		async put({ bucket, key, body, contentType }) {
			const client = new S3Client({
				accessKeyId,
				secretAccessKey,
				region,
				bucket,
				...(endpoint ? { endpoint } : {}),
			})
			const bytes =
				body instanceof Uint8Array
					? body
					: new Uint8Array(body as ArrayBuffer)
			await client.write(key, bytes, contentType ? { type: contentType } : {})
			return { url: `s3://${bucket}/${key}`, bucket, key }
		},
	}
}

let cached: Storage | null = null

export async function getStorage(): Promise<Storage> {
	if (cached) return cached
	const driver = (process.env.EMBER_STORAGE_DRIVER ?? "memory").toLowerCase()
	cached =
		driver === "s3" ? await createS3Storage() : createInMemoryStorage()
	return cached
}

// Test seam — let tests inject a stub without going through env.
export function _setStorageForTests(s: Storage | null): void {
	cached = s
}

export function bucketFor(prefix: "r-audio" | "r-photos" | "q-photos"): string {
	// All three live in the single ember bucket per BACKEND_HANDOFF.md §6;
	// the prefix is the per-purpose namespace inside it.
	return process.env.S3_BUCKET ?? "ember"
}

export function keyFor(
	prefix: "r-audio" | "r-photos" | "q-photos",
	parts: { giftId: string; questionId: string; ext: string },
): string {
	const ts = Date.now()
	return `${prefix}/${parts.giftId}/${parts.questionId}/${ts}.${parts.ext}`
}
