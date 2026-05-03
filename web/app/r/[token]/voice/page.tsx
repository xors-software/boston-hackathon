"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { EmberTextArea } from "@/components/ember/EmberTextArea"
import { type JournalEntry, newEntryId } from "../_lib/entries"
import { isArchived } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

function formatTimer(s: number): string {
	const m = Math.floor(s / 60)
	const sec = s % 60
	return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
}

export default function VoicePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated, update } = useParentState(token)

	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [transcript, setTranscript] = useState("")
	const [duration, setDuration] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const timerRef = useRef<number | null>(null)
	const startedAtRef = useRef<number>(0)
	const lastDurationRef = useRef(0)

	const archived = hydrated && isArchived(state.data)

	useEffect(() => {
		if (hydrated && archived) router.replace(`/r/${token}/journal`)
	}, [hydrated, archived, router, token])

	useEffect(() => {
		return () => {
			if (timerRef.current) window.clearInterval(timerRef.current)
		}
	}, [])

	const startRecording = async () => {
		setError(null)
		setTranscript("")
		setDuration(0)
		if (typeof MediaRecorder === "undefined") {
			setError("Voice input isn't supported on this browser.")
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mr = new MediaRecorder(stream)
			chunksRef.current = []
			mr.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data)
			}
			mr.onstop = async () => {
				for (const t of stream.getTracks()) t.stop()
				if (timerRef.current) {
					window.clearInterval(timerRef.current)
					timerRef.current = null
				}
				lastDurationRef.current = Math.floor(
					(Date.now() - startedAtRef.current) / 1000,
				)
				setDuration(lastDurationRef.current)
				const blob = new Blob(chunksRef.current, {
					type: mr.mimeType || "audio/webm",
				})
				chunksRef.current = []
				if (blob.size === 0) return
				await transcribe(blob)
			}
			startedAtRef.current = Date.now()
			mr.start()
			recorderRef.current = mr
			setRecording(true)
			timerRef.current = window.setInterval(() => {
				setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000))
			}, 250)
		} catch {
			setError("Couldn't access the microphone.")
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
			const res = await fetch(`/api/transcribe`, {
				method: "POST",
				body: fd,
			})
			const data = (await res.json()) as { text?: string; error?: string }
			if (!res.ok) {
				setError(data.error || "Transcription failed.")
				return
			}
			setTranscript((data.text || "").trim())
		} catch {
			setError("Couldn't reach the transcription service.")
		} finally {
			setTranscribing(false)
		}
	}

	const discard = () => {
		setTranscript("")
		setDuration(0)
		lastDurationRef.current = 0
		setError(null)
	}

	const save = () => {
		if (!transcript.trim()) return
		setSaving(true)
		const entries =
			(state.data.entries as JournalEntry[] | undefined) ?? []
		const entry: JournalEntry = {
			id: newEntryId(),
			createdAt: new Date().toISOString(),
			source: "voice",
			text: transcript.trim(),
			durationSeconds: lastDurationRef.current || undefined,
		}
		update({ data: { entries: [entry, ...entries] } })
		router.push(`/r/${token}/journal`)
	}

	const showRecorder = !transcript && !transcribing
	const showReview = transcript.length > 0 && !transcribing

	return (
		<main
			className="min-h-dvh w-full flex flex-col"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 pt-6 pb-6 sm:px-8">
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

				<header className="mt-4 mb-6">
					<p
						className="text-[11px] font-medium tracking-[0.22em] uppercase mb-2"
						style={{ color: "var(--ember-terracotta)" }}
					>
						Voice note
					</p>
					<h1 className="font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)] mb-2">
						{showReview ? (
							<>
								Sound{" "}
								<span
									className="italic"
									style={{ color: "var(--ember-terracotta)" }}
								>
									right
								</span>
								?
							</>
						) : (
							<>
								Press{" "}
								<span
									className="italic"
									style={{ color: "var(--ember-terracotta)" }}
								>
									record
								</span>
								. Take your time.
							</>
						)}
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						{showReview
							? "We transcribed what you said. Edit if you'd like, then save it to your journal."
							: "Speak whenever you're ready. We'll write it down for you."}
					</p>
				</header>

				{error && (
					<p className="mb-4 text-sm text-red-500">{error}</p>
				)}

				{showRecorder && (
					<div className="flex-1 flex flex-col items-center justify-center gap-6">
						<button
							type="button"
							onClick={recording ? stopRecording : startRecording}
							aria-label={recording ? "Stop recording" : "Start recording"}
							className={`flex items-center justify-center rounded-full transition-colors h-32 w-32 ${
								recording
									? "bg-red-500 hover:bg-red-600"
									: "bg-neutral-900 hover:bg-neutral-800"
							}`}
						>
							{recording ? (
								<span className="block h-10 w-10 rounded-md bg-[color:var(--ember-card)]" />
							) : (
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="h-12 w-12 text-white"
									aria-hidden="true"
								>
									<rect x="9" y="3" width="6" height="12" rx="3" />
									<path d="M5 11v1a7 7 0 0 0 14 0v-1" />
									<line x1="12" y1="19" x2="12" y2="22" />
								</svg>
							)}
						</button>
						<p className="text-2xl font-mono tabular-nums text-[color:var(--ember-ink)]">
							{formatTimer(duration)}
						</p>
						<p className="text-sm text-[color:var(--ember-warm-gray)]">
							{recording ? "Tap to stop" : "Tap the mic to start"}
						</p>
					</div>
				)}

				{transcribing && (
					<div className="flex-1 flex flex-col items-center justify-center gap-4">
						<svg
							className="h-10 w-10 animate-spin text-[color:var(--ember-warm-gray)]"
							viewBox="0 0 24 24"
							fill="none"
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
						<p className="text-sm text-[color:var(--ember-warm-gray)]">Transcribing…</p>
					</div>
				)}

				{showReview && (
					<div className="flex-1 flex flex-col gap-4">
						<div className="rounded-2xl bg-[color:var(--ember-input)] px-4 py-3 text-sm text-[color:var(--ember-warm-gray)] flex items-center justify-between">
							<span>{formatTimer(lastDurationRef.current || duration)}</span>
							<button
								type="button"
								onClick={discard}
								className="text-sm text-[color:var(--ember-warm-gray)] underline underline-offset-2 hover:text-[color:var(--ember-warm-gray)]"
							>
								Re-record
							</button>
						</div>

						<EmberTextArea
							value={transcript}
							onChange={setTranscript}
							placeholder="Edit your transcript"
							rows={10}
							max={4000}
							withMic={false}
						/>

						<button
							type="button"
							onClick={save}
							disabled={saving || !transcript.trim()}
							className="ember-cta"
						>
							{saving ? "Saving…" : "Save voice note"}
						</button>
					</div>
				)}
			</div>
		</main>
	)
}
