// Whisper-backed STT. Used both by the public POST /transcribe route
// (giver-side voice fields) and by the recipient voice endpoint, which
// stores both the raw audio AND the transcript.

export interface TranscribeResult {
	text: string
}

export class TranscribeError extends Error {
	status: number
	detail?: string
	constructor(message: string, status: number, detail?: string) {
		super(message)
		this.name = "TranscribeError"
		this.status = status
		this.detail = detail
	}
}

export function extFromMime(mime: string | undefined): string {
	if (!mime) return "webm"
	if (mime.includes("mp4")) return "mp4"
	if (mime.includes("mpeg")) return "mp3"
	if (mime.includes("wav")) return "wav"
	if (mime.includes("ogg")) return "ogg"
	if (mime.includes("m4a")) return "m4a"
	return "webm"
}

export interface TranscribeDeps {
	apiKey?: string
	fetchImpl?: typeof fetch
}

export async function transcribeAudio(
	file: File | Blob,
	filename: string,
	deps: TranscribeDeps = {},
): Promise<TranscribeResult> {
	const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY
	if (!apiKey) {
		throw new TranscribeError(
			"OPENAI_API_KEY is not configured on the server",
			500,
		)
	}
	const fd = new FormData()
	fd.append("file", file, filename)
	fd.append("model", "whisper-1")

	// Resolve via globalThis at call time so test-time overrides
	// (`globalThis.fetch = stub`) take effect.
	const fetchFn = deps.fetchImpl ?? globalThis.fetch
	const res = await fetchFn(
		"https://api.openai.com/v1/audio/transcriptions",
		{
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}` },
			body: fd,
		},
	)
	if (!res.ok) {
		const errText = await res.text()
		throw new TranscribeError("Transcription failed", res.status, errText)
	}
	const data = (await res.json()) as { text?: string }
	return { text: data.text ?? "" }
}
