import { Elysia, t } from "elysia"
import {
	extFromMime,
	TranscribeError,
	transcribeAudio,
} from "../lib/transcribe"

export const transcribeRoutes = new Elysia({ prefix: "/transcribe" }).post(
	"/",
	async ({ body, set }) => {
		const file = body.audio as File
		if (!file || file.size === 0) {
			set.status = 400
			return { error: "No audio file provided" }
		}
		const filename = file.name || `audio.${extFromMime(file.type)}`
		try {
			const { text } = await transcribeAudio(file, filename)
			return { text }
		} catch (err) {
			if (err instanceof TranscribeError) {
				console.error("Whisper error:", err.status, err.detail ?? err.message)
				set.status = err.status
				return { error: err.message, detail: err.detail }
			}
			console.error("Whisper unexpected error:", err)
			set.status = 500
			return { error: "Transcription failed" }
		}
	},
	{
		body: t.Object({
			audio: t.File({ maxSize: "25m" }),
		}),
	},
)
