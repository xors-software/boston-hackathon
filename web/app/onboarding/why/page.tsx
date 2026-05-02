"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useOnboardingState } from "../_lib/state"

const MAX_CHARS = 800

export default function WhyPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const [why, setWhy] = useState("")
	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [recError, setRecError] = useState<string | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.why
		if (typeof saved === "string") setWhy(saved)
	}, [hydrated, state.data.why])

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
				stream.getTracks().forEach((t) => t.stop())
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
		} catch {
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
			const res = await fetch(`/api/transcribe`, {
				method: "POST",
				body: fd,
			})
			const data = (await res.json()) as { text?: string; error?: string }
			if (!res.ok) {
				setRecError(data.error || "Transcription failed.")
				return
			}
			const text = (data.text || "").trim()
			if (!text) return
			setWhy((prev) => {
				const sep = prev && !prev.endsWith(" ") ? " " : ""
				return (prev + sep + text).slice(0, MAX_CHARS)
			})
		} catch {
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
		update({ step: "world", data: { why } })
		router.push("/onboarding/world")
	}

	const goSkip = () => {
		update({ step: "world" })
		router.push("/onboarding/world")
	}

	const goAiHelp = () => {
		update({ data: { why } })
		router.push("/onboarding/why/ai")
	}

	return (
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => router.back()}
						className="-ml-1 inline-flex items-center gap-1 py-2 text-base text-neutral-700 transition-colors hover:text-neutral-900"
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
						className="py-2 text-base text-neutral-500 transition-colors hover:text-neutral-700"
					>
						Skip
					</button>
				</div>

				<header className="mt-6 mb-8">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						Why do you want to make this for them?
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						This stays private to you. It helps us shape the experience.
					</p>
				</header>

				<div className="relative rounded-2xl border border-neutral-200 bg-white focus-within:border-neutral-900 transition-colors">
					<textarea
						value={why}
						onChange={(e) => setWhy(e.target.value.slice(0, MAX_CHARS))}
						placeholder="Start typing..."
						rows={8}
						disabled={transcribing}
						className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-12 text-base text-neutral-900 placeholder:text-neutral-400 outline-none disabled:opacity-60"
					/>
					<div className="pointer-events-none absolute left-4 bottom-3 text-sm text-neutral-400">
						{why.length} / {MAX_CHARS}
					</div>
					<button
						type="button"
						onClick={toggleRecord}
						disabled={transcribing}
						aria-label={recording ? "Stop recording" : "Record voice note"}
						className={`absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
							recording
								? "border-red-500 bg-red-500"
								: "border-neutral-300 bg-white hover:bg-neutral-100"
						} disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{transcribing ? (
							<svg
								className="h-4 w-4 animate-spin text-neutral-500"
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
						) : (
							<span
								className={`block h-3 w-3 rounded-full ${
									recording ? "bg-white animate-pulse" : "bg-neutral-700"
								}`}
							/>
						)}
					</button>
				</div>

				<p className="mt-4 flex items-start gap-1.5 text-sm text-neutral-500">
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						className="mt-0.5 h-4 w-4 shrink-0"
					>
						<circle cx="12" cy="12" r="9" />
						<line x1="12" y1="11" x2="12" y2="16" strokeLinecap="round" />
						<circle cx="12" cy="8" r="0.6" fill="currentColor" />
					</svg>
					<span>
						Personalizes their prompts and the gift letter. Never shared with
						them.
					</span>
				</p>

				{recError && <p className="mt-3 text-sm text-red-500">{recError}</p>}

				<div className="mt-6 flex flex-col gap-3">
					<button
						type="button"
						onClick={goNext}
						className="w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
					>
						Continue
					</button>

					<button
						type="button"
						onClick={goAiHelp}
						className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white py-4 text-base font-medium text-neutral-900 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="h-4 w-4"
						>
							<path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" />
						</svg>
						Brainstorm with AI
					</button>
				</div>

				<div className="mt-5 text-center">
					<button
						type="button"
						onClick={goSkip}
						className="text-sm text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-700"
					>
						Skip for now
					</button>
				</div>
			</div>
		</main>
	)
}
