"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, type FormEvent, useRef, useState } from "react"
import { useOnboardingState } from "../../_lib/state"

const QUESTION_MAX = 280

type CustomQuestion = {
	id: string
	text: string
	photoDataUrl?: string
	preface?: string
}

type QuestionsState = {
	selectedIds: string[]
	custom: CustomQuestion[]
}

const newId = () =>
	`q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export default function WriteQuestionPage() {
	const router = useRouter()
	const { state, update } = useOnboardingState()

	const [text, setText] = useState("")
	const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
	const [photoError, setPhotoError] = useState<string | null>(null)
	const [preface, setPreface] = useState("")
	const fileInputRef = useRef<HTMLInputElement>(null)

	const trimmed = text.trim()
	const canSave = trimmed.length > 0

	const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
		setPhotoError(null)
		const file = e.target.files?.[0]
		if (!file) return
		if (!file.type.startsWith("image/")) {
			setPhotoError("Please pick an image file.")
			return
		}
		// 4MB cap — keeps localStorage happy on most setups
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

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSave) return

		const id = newId()
		const newQ: CustomQuestion = {
			id,
			text: trimmed,
			photoDataUrl: photoDataUrl ?? undefined,
			preface: preface.trim() || undefined,
		}

		const prev = (state.data.questions as QuestionsState | undefined) ?? {
			selectedIds: [],
			custom: [],
		}
		const next: QuestionsState = {
			selectedIds: [...prev.selectedIds, id],
			custom: [newQ, ...prev.custom],
		}

		update({ data: { questions: next } })
		router.push("/onboarding/questions")
	}

	return (
		<main className="min-h-dvh bg-white">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
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

				<header className="mt-6 mb-6">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-neutral-900">
						Write your own question.
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						Make it specific. The best ones are.
					</p>
				</header>

				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-neutral-700">
							Question
						</span>
						<div className="relative rounded-2xl border border-neutral-200 bg-white focus-within:border-neutral-900 transition-colors">
							<textarea
								value={text}
								onChange={(e) => setText(e.target.value.slice(0, QUESTION_MAX))}
								placeholder="What were you thinking about on the drive home from the hospital?"
								rows={4}
								autoFocus
								className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-3 pb-7 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
							/>
							<div className="pointer-events-none absolute left-4 bottom-2 text-xs text-neutral-400">
								{text.length} / {QUESTION_MAX}
							</div>
						</div>
					</label>

					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-neutral-700">
							Photo (optional)
						</span>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handlePhotoChange}
							className="hidden"
						/>
						{photoDataUrl ? (
							<div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
								<img
									src={photoDataUrl}
									alt="Question photo preview"
									className="block w-full max-h-64 object-cover"
								/>
								<div className="flex items-center justify-end gap-3 px-4 py-2 bg-white border-t border-neutral-200">
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
									>
										Replace
									</button>
									<button
										type="button"
										onClick={() => {
											setPhotoDataUrl(null)
											if (fileInputRef.current) fileInputRef.current.value = ""
										}}
										className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
									>
										Remove
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-100"
							>
								<div className="flex justify-center mb-3">
									<svg
										aria-hidden="true"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.75"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="h-7 w-7 text-neutral-400"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
								</div>
								<div className="text-base text-neutral-600">
									Add a photo from camera or library
								</div>
							</button>
						)}
						{photoError && (
							<p className="text-sm text-red-500">{photoError}</p>
						)}
					</div>

					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-neutral-700">
							Preface (optional)
						</span>
						<input
							type="text"
							value={preface}
							onChange={(e) => setPreface(e.target.value)}
							placeholder='"When you see this photo, tell me about..."'
							className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 transition-colors"
						/>
					</label>

					<button
						type="submit"
						disabled={!canSave}
						className="mt-2 w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Save question
					</button>

					<button
						type="button"
						onClick={() => router.back()}
						className="text-center text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700 transition-colors"
					>
						Cancel
					</button>
				</form>
			</div>
		</main>
	)
}
