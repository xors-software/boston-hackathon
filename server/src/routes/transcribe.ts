import { Elysia, t } from "elysia";

export const transcribeRoutes = new Elysia({ prefix: "/transcribe" }).post(
	"/",
	async ({ body, set }) => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			set.status = 500;
			return { error: "OPENAI_API_KEY is not configured on the server" };
		}

		const file = body.audio as File;
		if (!file || file.size === 0) {
			set.status = 400;
			return { error: "No audio file provided" };
		}

		const filename = file.name || `audio.${extFromMime(file.type)}`;
		const fd = new FormData();
		fd.append("file", file, filename);
		fd.append("model", "whisper-1");

		const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}` },
			body: fd,
		});

		if (!res.ok) {
			set.status = res.status;
			const errText = await res.text();
			console.error("Whisper error:", res.status, errText);
			return { error: "Transcription failed", detail: errText };
		}

		const data = (await res.json()) as { text?: string };
		return { text: data.text ?? "" };
	},
	{
		body: t.Object({
			audio: t.File({ maxSize: "25m" }),
		}),
	},
);

function extFromMime(mime: string): string {
	if (!mime) return "webm";
	if (mime.includes("mp4")) return "mp4";
	if (mime.includes("mpeg")) return "mp3";
	if (mime.includes("wav")) return "wav";
	if (mime.includes("ogg")) return "ogg";
	return "webm";
}
