"use client"

import { type ChangeEvent, type FormEvent, useRef, useState } from "react"
import { EmberTextArea } from "@/components/ember/EmberTextArea"
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
	const fileInputRef = useRef<HTMLInputElement>(null)

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

			<EmberTextArea
				value={text}
				onChange={setText}
				placeholder="Start writing"
				max={TEXT_MAX}
				rows={6}
				autoFocus={autoFocus}
			/>

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
					style={{ backgroundColor: "var(--ember-input)" }}
				>
					<img
						src={photoDataUrl}
						alt="Entry"
						className="block w-full max-h-64 object-cover"
					/>
					<div
						className="flex items-center justify-end gap-3 px-4 py-2"
						style={{ borderTop: "1px solid var(--ember-divider)" }}
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
				<p
					className="text-sm"
					style={{ color: "var(--ember-terracotta)" }}
				>
					{photoError}
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
					className="ember-cta ember-cta-with-arrow"
				>
					<span>{saveLabel}</span>
					<span aria-hidden="true" className="ember-cta-arrow">
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
