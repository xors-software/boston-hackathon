import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { S3Client } from "bun";

// Storage interface lets us swap implementations without touching call sites.
// Today: S3-compatible (Railway / R2 / AWS) via Bun's native client.
// Future: pre-signed URL flow, or local-disk for dev, plug in here.
export interface PhotoStorage {
	put(key: string, file: File | Blob): Promise<{ key: string; url: string }>;
	get(key: string): Promise<File | null>;
}

// Disk-backed fallback for local dev / e2e where standing up S3 is overkill.
// Files land under PHOTO_STORAGE_LOCAL_DIR; the URL is a fully-qualified path
// the API can serve via /photos/* if we ever wire that — for now, the URL is
// only used as a database marker that the upload happened.
class LocalPhotoStorage implements PhotoStorage {
	constructor(private baseDir: string) {}

	async put(
		key: string,
		file: File | Blob,
	): Promise<{ key: string; url: string }> {
		const path = join(this.baseDir, key);
		await mkdir(dirname(path), { recursive: true });
		const buf = await file.arrayBuffer();
		await writeFile(path, new Uint8Array(buf));
		return { key, url: `local:${path}` };
	}

	async get(key: string): Promise<File | null> {
		try {
			const buf = await readFile(join(this.baseDir, key));
			return new File([buf], key.split("/").pop() ?? key);
		} catch {
			return null;
		}
	}
}

class S3PhotoStorage implements PhotoStorage {
	private client: S3Client;
	private bucket: string;

	constructor(opts: {
		endpoint: string;
		region: string;
		bucket: string;
		accessKeyId: string;
		secretAccessKey: string;
	}) {
		this.bucket = opts.bucket;
		this.client = new S3Client({
			endpoint: opts.endpoint,
			region: opts.region,
			bucket: opts.bucket,
			accessKeyId: opts.accessKeyId,
			secretAccessKey: opts.secretAccessKey,
		});
	}

	async put(
		key: string,
		file: File | Blob,
	): Promise<{ key: string; url: string }> {
		const contentType =
			(file instanceof File && file.type) || "application/octet-stream";
		await this.client.write(key, file, { type: contentType });
		// Photos are private by default. The recipient view fetches them through
		// our API which hands back a signed URL — never expose the bucket directly.
		return { key, url: `s3://${this.bucket}/${key}` };
	}

	async get(key: string): Promise<File | null> {
		try {
			const obj = this.client.file(key);
			const exists = await obj.exists();
			if (!exists) return null;
			const buf = await obj.arrayBuffer();
			const meta = await obj.stat();
			return new File([buf], key.split("/").pop() ?? key, {
				type: meta.type ?? "application/octet-stream",
			});
		} catch {
			return null;
		}
	}

	presignedGetUrl(key: string, expiresInSeconds = 60 * 10): string {
		return this.client.presign(key, {
			method: "GET",
			expiresIn: expiresInSeconds,
		});
	}
}

let cached: PhotoStorage | null = null;

export function getPhotoStorage(): PhotoStorage {
	if (cached) return cached;
	const localDir = process.env.PHOTO_STORAGE_LOCAL_DIR;
	if (localDir) {
		cached = new LocalPhotoStorage(localDir);
		return cached;
	}
	const endpoint = process.env.S3_ENDPOINT;
	const bucket = process.env.S3_BUCKET;
	const accessKeyId = process.env.S3_ACCESS_KEY_ID;
	const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
	const region = process.env.S3_REGION ?? "auto";
	if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
		throw new Error(
			"Photo storage not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (or PHOTO_STORAGE_LOCAL_DIR for local dev).",
		);
	}
	cached = new S3PhotoStorage({
		endpoint,
		region,
		bucket,
		accessKeyId,
		secretAccessKey,
	});
	return cached;
}

// For ad-hoc presigning where we only have a URL ("s3://bucket/key") stored
// on the question row. Returns null if storage isn't S3-backed.
export function presignFromS3Url(s3Url: string, expiresInSeconds = 600): string | null {
	const storage = getPhotoStorage();
	if (!(storage instanceof S3PhotoStorage)) return null;
	const m = /^s3:\/\/[^/]+\/(.+)$/.exec(s3Url);
	if (!m) return null;
	return storage.presignedGetUrl(m[1], expiresInSeconds);
}
