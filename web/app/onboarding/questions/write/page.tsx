"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react"
import { useOnboardingState } from "../../_lib/state"
import { getStoredGiftId, useEnsureGift } from "../../_lib/sync"

const QUESTION_MAX = 280
const PHOTO_MAX_BYTES = 10 * 1024 * 1024 // 10MB — matches server cap

type CustomQuestion = {
	id: string
	text: string
	preface?: string
	photoUrl?: string
}

type QuestionsState = {
	selectedIds: string[]
	custom: CustomQuestion[]
	edits?: Record<string, string>
}

function apiBase(): string {
	const direct = process.env.NEXT_PUBLIC_API_URL
	if (direct) return direct.replace(/\/$/, "")
	if (typeof window !== "undefined") return `${window.location.origin}/api`
	return "http://localhost:3000/api"
}

export default function WriteQuestionPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()
	// useEnsureGift is the single source of truth for gift creation across
	// onboarding (set up on the account page). We piggy-back on it here so
	// landing directly on /write still has a giftId to upload against.
	const { giftId, creating } = useEnsureGift(hydrated ? state : null)

	const [text, setText] = useState("")
	const [photoFile, setPhotoFile] = useState<File | null>(null)
	const [photoPreview, setPhotoPreview] = useState<string | null>(null)
	const [photoError, setPhotoError] = useState<string | null>(null)
	const [preface, setPreface] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const trimmed = text.trim()
	const canSave = trimmed.length > 0 && !submitting && !creating && Boolean(giftId)

	// Object URL preview only — no base64, no localStorage. The server holds
	// the canonical image once uploaded; the preview lives just for this view.
	useEffect(() => {
		if (!photoFile) {
			setPhotoPreview(null)
			return
		}
		const url = URL.createObjectURL(photoFile)
		setPhotoPreview(url)
		return () => URL.revokeObjectURL(url)
	}, [photoFile])

	const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
		setPhotoError(null)
		const file = e.target.files?.[0]
		if (!file) return
		if (!file.type.startsWith("image/")) {
			setPhotoError("Please pick an image file.")
			return
		}
		if (file.size > PHOTO_MAX_BYTES) {
			setPhotoError("Photo is too large. Pick one under 10MB.")
			return
		}
		setPhotoFile(file)
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!canSave) return
		setSubmitting(true)
		setSubmitError(null)
		try {
			const id = giftId ?? getStoredGiftId()
			if (!id) {
				throw new Error("No gift in progress — finish onboarding setup first.")
			}

			const createRes = await fetch(`${apiBase()}/gifts/${id}/questions`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					source: "custom",
					text: trimmed,
					preface: preface.trim() || undefined,
				}),
			})
			if (!createRes.ok) {
				throw new Error(`Failed to create question (${createRes.status})`)
			}
			const { question } = (await createRes.json()) as {
				question: { id: string }
			}

			let photoUrl: string | undefined
			if (photoFile) {
				const fd = new FormData()
				fd.append("photo", photoFile)
				const photoRes = await fetch(
					`${apiBase()}/gifts/${id}/questions/${question.id}/photo`,
					{ method: "POST", credentials: "include", body: fd },
				)
				if (!photoRes.ok) {
					throw new Error(`Failed to upload photo (${photoRes.status})`)
				}
				const { question: updated } = (await photoRes.json()) as {
					question: { photoUrl: string | null }
				}
				photoUrl = updated.photoUrl ?? undefined
			}

			const newQ: CustomQuestion = {
				id: question.id,
				text: trimmed,
				preface: preface.trim() || undefined,
				photoUrl,
			}

			const prev = (state.data.questions as QuestionsState | undefined) ?? {
				selectedIds: [],
				custom: [],
			}
			const next: QuestionsState = {
				selectedIds: [...prev.selectedIds, question.id],
				custom: [newQ, ...prev.custom],
				edits: prev.edits,
			}

			update({ data: { questions: next } })
			router.push("/onboarding/questions")
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : "Something went wrong saving.",
			)
		} finally {
			setSubmitting(false)
		}
	}

	if (!hydrated) {
		return <main className="min-h-dvh bg-white" />
	}

	return (
		<main className="min-h-dvh bg-[color:var(--ember-card)]">
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-12 sm:px-8">
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

				<header className="mt-6 mb-6">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)]">
						Write your own question.
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Make it specific. The best ones are.
					</p>
				</header>

				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-[color:var(--ember-warm-gray)]">
							Question
						</span>
						<div className="relative rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] focus-within:border-neutral-900 transition-colors">
							<textarea
								value={text}
								onChange={(e) => setText(e.target.value.slice(0, QUESTION_MAX))}
								placeholder="What were you thinking about on the drive home from the hospital?"
								rows={4}
								autoFocus
								className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-3 pb-7 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none"
							/>
							<div className="pointer-events-none absolute left-4 bottom-2 text-xs text-[color:var(--ember-soft-gray)]">
								{text.length} / {QUESTION_MAX}
							</div>
						</div>
					</label>

					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-[color:var(--ember-warm-gray)]">
							Photo (optional)
						</span>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handlePhotoChange}
							className="hidden"
						/>
						{photoPreview ? (
							<div className="relative rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-cream-light)] overflow-hidden">
								<img
									src={photoPreview}
									alt="Question photo preview"
									className="block w-full max-h-64 object-cover"
								/>
								<div className="flex items-center justify-end gap-3 px-4 py-2 bg-[color:var(--ember-card)] border-t border-[color:var(--ember-divider)]">
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="text-sm text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-ink)] transition-colors"
									>
										Replace
									</button>
									<button
										type="button"
										onClick={() => {
											setPhotoFile(null)
											if (fileInputRef.current) fileInputRef.current.value = ""
										}}
										className="text-sm text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-warm-gray)] transition-colors"
									>
										Remove
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="rounded-2xl border border-dashed border-[color:var(--ember-divider)] bg-[color:var(--ember-cream-light)] px-5 py-10 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-100"
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
										className="h-7 w-7 text-[color:var(--ember-soft-gray)]"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
								</div>
								<div className="text-base text-[color:var(--ember-warm-gray)]">
									Add a photo from camera or library
								</div>
							</button>
						)}
						{photoError && (
							<p className="text-sm text-red-500">{photoError}</p>
						)}
					</div>

					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium text-[color:var(--ember-warm-gray)]">
							Preface (optional)
						</span>
						<input
							type="text"
							value={preface}
							onChange={(e) => setPreface(e.target.value)}
							placeholder='"When you see this photo, tell me about..."'
							className="w-full rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-4 py-3 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
						/>
					</label>

					{submitError && (
						<p className="text-sm text-red-500">{submitError}</p>
					)}

					<button
						type="submit"
						disabled={!canSave}
						className="ember-cta"
					>
						{submitting ? "Saving…" : "Save question"}
					</button>

					<button
						type="button"
						onClick={() => router.back()}
						className="text-center text-sm text-[color:var(--ember-warm-gray)] underline underline-offset-2 hover:text-[color:var(--ember-warm-gray)] transition-colors"
					>
						Cancel
					</button>
				</form>
			</div>
		</main>
	)
}
