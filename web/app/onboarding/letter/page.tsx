"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useOnboardingState } from "../_lib/state"

const MAX_CHARS = 4000

const RECIPIENT_LABELS: Record<
	string,
	{ name: string; subject: string; possessive: string }
> = {
	mom: { name: "Mom", subject: "her", possessive: "her" },
	dad: { name: "Dad", subject: "him", possessive: "his" },
	"loved-one": { name: "them", subject: "them", possessive: "their" },
	undecided: { name: "them", subject: "them", possessive: "their" },
}

export default function LetterPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const labels = RECIPIENT_LABELS[intent] ?? RECIPIENT_LABELS["loved-one"]
	const recipientName =
		(state.data.recipientName as string | undefined) || labels.name

	const [letter, setLetter] = useState("")
	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [recError, setRecError] = useState<string | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.personalMessage
		if (typeof saved === "string") setLetter(saved)
	}, [hydrated, state.data.personalMessage])

	const startRecording = async () => {
		setRecError(null)
		if (typeof MediaRecorder === "undefined") {
			setRecError("Voice input isn't supported on this browser.")
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mr = new MediaRecorder(stream)
			chunksRef.current = []
			mr.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
			}
			mr.onstop = async () => {
				for (const t of stream.getTracks()) t.stop()
				const blob = new Blob(chunksRef.current, {
					type: mr.mimeType || "audio/webm",
				})
				chunksRef.current = []
				if (blob.size === 0) return
				await transcribe(blob)
			}
			mr.start()
			recorderRef.current = mr
			setRecording(true)
		} catch (err) {
			console.error(err)
			setRecError("Couldn't access the microphone.")
		}
	}

	const stopRecording = () => {
		const mr = recorderRef.current
		if (!mr) return
		if (mr.state !== "inactive") mr.stop()
		setRecording(false)
	}

	const transcribe = async (blob: Blob) => {
		setTranscribing(true)
		try {
			const ext = (blob.type.split("/")[1] || "webm").split(";")[0]
			const fd = new FormData()
			fd.append("audio", blob, `audio.${ext}`)
			const res = await fetch(`/api/transcribe`, { method: "POST", body: fd })
			const data = (await res.json()) as { text?: string; error?: string }
			if (!res.ok) {
				setRecError(data.error || "Transcription failed.")
				return
			}
			const text = (data.text || "").trim()
			if (!text) return
			setLetter((prev) => {
				const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : ""
				return (prev + sep + text).slice(0, MAX_CHARS)
			})
		} catch (err) {
			console.error(err)
			setRecError("Couldn't reach the transcription service.")
		} finally {
			setTranscribing(false)
		}
	}

	const toggleRecord = () => {
		if (transcribing) return
		recording ? stopRecording() : startRecording()
	}

	const goNext = () => {
		// Trim trailing whitespace; treat empty as null so the parent renders
		// the generic warm letter. The server-side default for unset is null.
		const trimmed = letter.trim()
		update({
			step: "send",
			data: { personalMessage: trimmed.length > 0 ? trimmed : "" },
		})
		router.push("/onboarding/send")
	}

	const goSkip = () => {
		update({ step: "send", data: { personalMessage: "" } })
		router.push("/onboarding/send")
	}

	return (
		<main className="min-h-dvh bg-[color:var(--ember-card)]">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => router.back()}
						className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:text-[color:var(--ember-ink)]"
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-4 w-4"
						>
							<polyline points="15 6 9 12 15 18" />
						</svg>
						Back
					</button>
					<button
						type="button"
						onClick={goSkip}
						className="py-2 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:text-[color:var(--ember-warm-gray)]"
					>
						Skip
					</button>
				</div>

				<header className="mt-6 mb-8">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)]">
						Write a note to {recipientName}.
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						The first thing they'll read when they open it. Keep it short, or
						don't — you can change your mind before sending.
					</p>
				</header>

				<div className="relative rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] focus-within:border-neutral-900 transition-colors">
					<textarea
						value={letter}
						onChange={(e) => setLetter(e.target.value.slice(0, MAX_CHARS))}
						placeholder={
							transcribing
								? "Transcribing…"
								: `${recipientName} —\n\nI made you something. Open whenever you have a quiet minute.`
						}
						rows={10}
						disabled={transcribing}
						className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-12 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none disabled:opacity-60"
					/>
					<div className="pointer-events-none absolute left-4 bottom-3 text-sm text-[color:var(--ember-soft-gray)]">
						{letter.length} / {MAX_CHARS}
					</div>
					<button
						type="button"
						onClick={toggleRecord}
						disabled={transcribing}
						aria-label={recording ? "Stop recording" : "Record voice note"}
						className={`absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
							recording
								? "border-red-500 bg-red-500"
								: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] hover:bg-neutral-100"
						} disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{transcribing ? (
							<svg
								className="h-4 w-4 animate-spin text-[color:var(--ember-warm-gray)]"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
							>
								<circle
									cx="12"
									cy="12"
									r="9"
									stroke="currentColor"
									strokeWidth="2"
									opacity="0.25"
								/>
								<path
									d="M21 12a9 9 0 0 0-9-9"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
								/>
							</svg>
						) : (
							<span
								className={`block h-3 w-3 rounded-full ${recording ? "bg-[color:var(--ember-card)] animate-pulse" : "bg-neutral-700"}`}
							/>
						)}
					</button>
				</div>

				{recError && (
					<p className="mt-3 text-sm text-red-500" role="alert">
						{recError}
					</p>
				)}

				<p className="mt-4 text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
					Optional. If you skip, we'll show {recipientName} a warm generic
					letter that explains how the gift works.
				</p>

				<button
					type="button"
					onClick={goNext}
					className="ember-cta"
				>
					Continue
				</button>
			</div>
		</main>
	)
}
