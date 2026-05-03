"use client"

import { type ChangeEvent, type FormEvent, useRef, useState } from "react"
import type { JournalEntrySource } from "../_lib/entries"

const TEXT_MAX = 4000

export type EntryDraft = {
	text?: string
	photoDataUrl?: string
	source: JournalEntrySource
	promptId?: string
	promptText?: string
}

type Props = {
	promptId?: string
	promptText?: string
	initialText?: string
	saveLabel?: string
	autoFocus?: boolean
	onSave: (draft: EntryDraft) => void
	onCancel?: () => void
}

export function EntryComposer({
	promptId,
	promptText,
	initialText = "",
	saveLabel = "Save entry",
	autoFocus,
	onSave,
	onCancel,
}: Props) {
	const [text, setText] = useState(initialText)
	const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
	const [photoError, setPhotoError] = useState<string | null>(null)

	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [recError, setRecError] = useState<string | null>(null)

	const fileInputRef = useRef<HTMLInputElement>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	const canSave = text.trim().length > 0 || Boolean(photoDataUrl)

	const submit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSave) return
		const trimmed = text.trim()
		const source: JournalEntrySource = promptId
			? "prompt"
			: photoDataUrl && !trimmed
				? "photo"
				: "free-write"
		onSave({
			text: trimmed || undefined,
			photoDataUrl: photoDataUrl ?? undefined,
			promptId,
			promptText,
			source,
		})
	}

	// ─── photo ───
	const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
		setPhotoError(null)
		const file = e.target.files?.[0]
		if (!file) return
		if (!file.type.startsWith("image/")) {
			setPhotoError("Please pick an image file.")
			return
		}
		if (file.size > 4 * 1024 * 1024) {
			setPhotoError("Photo is too large. Pick one under 4MB.")
			return
		}
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result === "string") setPhotoDataUrl(reader.result)
		}
		reader.onerror = () => setPhotoError("Couldn't read that file.")
		reader.readAsDataURL(file)
	}

	// ─── voice ───
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
				if (e.data.size > 0) chunksRef.current.push(e.data)
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
			const res = await fetch(`/api/transcribe`, { method: "POST", body: fd })
			const data = (await res.json()) as { text?: string; error?: string }
			if (!res.ok) {
				setRecError(data.error || "Transcription failed.")
				return
			}
			const out = (data.text || "").trim()
			if (!out) return
			setText((prev) => {
				const sep = prev && !prev.endsWith(" ") ? " " : ""
				return (prev + sep + out).slice(0, TEXT_MAX)
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

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			{promptText && (
				<p
					className="font-serif italic text-base"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					"{promptText}"
				</p>
			)}

			<div
				className="relative rounded-2xl"
				style={{ backgroundColor: "var(--ember-input)" }}
			>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
					placeholder={transcribing ? "Transcribing…" : "Start writing"}
					rows={6}
					disabled={transcribing}
					className="w-full resize-none rounded-2xl bg-transparent px-5 pt-5 pb-14 text-lg font-serif italic placeholder:italic outline-none disabled:opacity-60"
					style={{ color: "var(--ember-ink)" }}
				/>
				<div
					className="pointer-events-none absolute left-5 bottom-4 text-base font-serif"
					style={{ color: "var(--ember-soft-gray)" }}
				>
					{text.length} / {TEXT_MAX}
				</div>
				<button
					type="button"
					onClick={toggleRecord}
					disabled={transcribing}
					aria-label={recording ? "Stop recording" : "Record voice"}
					className="absolute right-4 bottom-3 flex h-10 w-10 items-center justify-center rounded-full transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
					style={{
						backgroundColor: recording ? "var(--ember-terracotta)" : "transparent",
						color: recording ? "#fff" : "var(--ember-warm-gray)",
						border: recording
							? "1px solid var(--ember-terracotta)"
							: "1px solid var(--ember-divider)",
					}}
				>
					{transcribing ? (
						<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
							<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
						</svg>
					) : recording ? (
						<span className="block h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
					) : (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
							<rect x="9" y="3" width="6" height="12" rx="3" />
							<path d="M5 11v1a7 7 0 0 0 14 0v-1" />
							<line x1="12" y1="19" x2="12" y2="22" />
						</svg>
					)}
				</button>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={handlePhoto}
				className="hidden"
			/>

			{photoDataUrl ? (
				<div
					className="relative rounded-2xl overflow-hidden"
					style={{ backgroundColor: "var(--ember-cream-light)" }}
				>
					<img
						src={photoDataUrl}
						alt="Entry"
						className="block w-full max-h-64 object-cover"
					/>
					<div
						className="flex items-center justify-end gap-3 px-4 py-2"
						style={{
							borderTop: "1px solid var(--ember-divider)",
						}}
					>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="font-serif italic text-sm"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							Replace
						</button>
						<button
							type="button"
							onClick={() => {
								setPhotoDataUrl(null)
								if (fileInputRef.current) fileInputRef.current.value = ""
							}}
							className="font-serif italic text-sm"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							Remove
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm self-start transition-opacity hover:opacity-80"
					style={{
						backgroundColor: "transparent",
						color: "var(--ember-warm-gray)",
						border: "1px solid var(--ember-divider)",
					}}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						className="h-4 w-4"
						aria-hidden="true"
					>
						<rect x="3" y="5" width="18" height="14" rx="2" />
						<circle cx="9" cy="11" r="2" />
						<polyline points="21 16 15 11 5 19" />
					</svg>
					<span className="font-serif italic">Add a photo</span>
				</button>
			)}

			{photoError && (
				<p className="text-sm" style={{ color: "var(--ember-terracotta)" }}>
					{photoError}
				</p>
			)}
			{recError && (
				<p className="text-sm" style={{ color: "var(--ember-terracotta)" }}>
					{recError}
				</p>
			)}

			<div className="flex items-center justify-end gap-3">
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="font-serif italic px-4 py-2 text-base transition-opacity hover:opacity-80"
						style={{ color: "var(--ember-warm-gray)" }}
					>
						Cancel
					</button>
				)}
				<button
					type="submit"
					disabled={!canSave}
					className="group relative inline-flex items-center justify-center rounded-full pl-6 pr-14 py-3.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					style={{ backgroundColor: "var(--ember-ink)" }}
				>
					<span>{saveLabel}</span>
					<span
						aria-hidden="true"
						className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full"
						style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-4 w-4"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="13 6 19 12 13 18" />
						</svg>
					</span>
				</button>
			</div>
		</form>
	)
}
