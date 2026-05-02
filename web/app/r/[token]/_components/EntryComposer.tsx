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
				<p className="text-base italic text-neutral-700">"{promptText}"</p>
			)}

			<div className="relative rounded-2xl bg-white border border-neutral-200 focus-within:border-neutral-900 transition-colors">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
					placeholder={transcribing ? "Transcribing…" : "Start writing..."}
					rows={6}
					autoFocus={autoFocus}
					disabled={transcribing}
					className="w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-12 text-base text-neutral-900 placeholder:text-neutral-400 placeholder:italic outline-none disabled:opacity-60"
				/>
				<div className="pointer-events-none absolute left-4 bottom-3 text-xs text-neutral-400">
					{text.length} / {TEXT_MAX}
				</div>
				<button
					type="button"
					onClick={toggleRecord}
					disabled={transcribing}
					aria-label={recording ? "Stop recording" : "Record voice"}
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
					) : recording ? (
						<span className="block h-3 w-3 rounded-full bg-white animate-pulse" />
					) : (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							className="h-4 w-4 text-neutral-700"
							aria-hidden="true"
						>
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
				<div className="relative rounded-2xl border border-neutral-200 bg-white overflow-hidden">
					<img
						src={photoDataUrl}
						alt="Entry"
						className="block w-full max-h-64 object-cover"
					/>
					<div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-neutral-200">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="text-sm text-neutral-700 hover:text-neutral-900"
						>
							Replace
						</button>
						<button
							type="button"
							onClick={() => {
								setPhotoDataUrl(null)
								if (fileInputRef.current) fileInputRef.current.value = ""
							}}
							className="text-sm text-neutral-500 hover:text-neutral-700"
						>
							Remove
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 self-start"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						className="h-4 w-4"
						aria-hidden="true"
					>
						<rect x="3" y="5" width="18" height="14" rx="2" />
						<circle cx="9" cy="11" r="2" />
						<polyline points="21 16 15 11 5 19" />
					</svg>
					Add a photo
				</button>
			)}

			{photoError && <p className="text-sm text-red-500">{photoError}</p>}
			{recError && <p className="text-sm text-red-500">{recError}</p>}

			<div className="flex items-center justify-end gap-3">
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
					>
						Cancel
					</button>
				)}
				<button
					type="submit"
					disabled={!canSave}
					className="rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{saveLabel}
				</button>
			</div>
		</form>
	)
}
