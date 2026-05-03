"use client"

import { useRef, useState, type ChangeEvent } from "react"

type Props = {
	value: string
	onChange: (v: string) => void
	placeholder?: string
	max?: number
	rows?: number
	autoFocus?: boolean
	disabled?: boolean
	withMic?: boolean
	withCounter?: boolean
}

// The canonical Ember writing surface — white card, italic serif placeholder,
// large serif counter bottom-left, optional outlined mic icon bottom-right.
// Used everywhere a parent or child writes more than one line.
export function EmberTextArea({
	value,
	onChange,
	placeholder = "Start writing",
	max = 4000,
	rows = 8,
	autoFocus,
	disabled,
	withMic = true,
	withCounter = true,
}: Props) {
	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	const startRecording = async () => {
		setError(null)
		if (typeof MediaRecorder === "undefined") {
			setError("Voice input isn't supported here.")
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
			const res = await fetch(`/api/transcribe`, { method: "POST", body: fd })
			const data = (await res.json()) as { text?: string; error?: string }
			if (!res.ok) {
				setError(data.error || "Transcription failed.")
				return
			}
			const out = (data.text || "").trim()
			if (!out) return
			const sep = value && !value.endsWith(" ") ? " " : ""
			onChange((value + sep + out).slice(0, max))
		} catch {
			setError("Couldn't reach the transcription service.")
		} finally {
			setTranscribing(false)
		}
	}

	const toggle = () => {
		if (transcribing) return
		recording ? stopRecording() : startRecording()
	}

	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
		onChange(e.target.value.slice(0, max))

	return (
		<>
			<div
				className="relative rounded-3xl"
				style={{
					backgroundColor: "var(--ember-input)",
					boxShadow: "0 1px 0 rgba(255,255,255,.6) inset, 0 8px 24px -16px rgba(20, 12, 4, .12)",
				}}
			>
				<textarea
					value={value}
					onChange={handleChange}
					placeholder={transcribing ? "Transcribing…" : placeholder}
					rows={rows}
					autoFocus={autoFocus}
					disabled={transcribing || disabled}
					className="w-full resize-none rounded-3xl bg-transparent px-7 pt-7 pb-16 text-xl font-serif italic placeholder:italic outline-none disabled:opacity-60"
					style={{ color: "var(--ember-ink)" }}
				/>
				{withCounter && (
					<div
						className="pointer-events-none absolute left-7 bottom-5 text-lg font-serif tracking-wide"
						style={{ color: "var(--ember-soft-gray)" }}
					>
						{value.length} / {max}
					</div>
				)}
				{withMic && (
					<button
						type="button"
						onClick={toggle}
						disabled={transcribing}
						aria-label={recording ? "Stop recording" : "Record voice"}
						className="absolute right-5 bottom-4 flex h-12 w-12 items-center justify-center rounded-full transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
						style={{
							backgroundColor: recording
								? "var(--ember-terracotta)"
								: "transparent",
							color: recording ? "#fff" : "var(--ember-warm-gray)",
							border: recording
								? "1px solid var(--ember-terracotta)"
								: "1px solid var(--ember-divider)",
						}}
					>
						{transcribing ? (
							<svg
								className="h-5 w-5 animate-spin"
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
						) : recording ? (
							<span className="block h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
						) : (
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="h-5 w-5"
								aria-hidden="true"
							>
								<rect x="9" y="3" width="6" height="12" rx="3" />
								<path d="M5 11v1a7 7 0 0 0 14 0v-1" />
								<line x1="12" y1="19" x2="12" y2="22" />
							</svg>
						)}
					</button>
				)}
			</div>
			{error && (
				<p
					className="mt-2 text-sm font-serif italic"
					style={{ color: "var(--ember-terracotta)" }}
					role="alert"
				>
					{error}
				</p>
			)}
		</>
	)
}
