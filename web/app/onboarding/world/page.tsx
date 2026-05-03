"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { useOnboardingState } from "../_lib/state"

const DESC_MAX = 240

const RELATIONSHIP_LABELS: Record<
	string,
	{ subject: string; possessive: string }
> = {
	mom: { subject: "her", possessive: "her" },
	dad: { subject: "him", possessive: "his" },
	"loved-one": { subject: "them", possessive: "their" },
	undecided: { subject: "them", possessive: "their" },
}

type Person = {
	id: string
	name: string
	relationship: string
	age: string
	description: string
}

const newId = () =>
	`p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export default function WorldPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const labels = RELATIONSHIP_LABELS[intent] ?? RELATIONSHIP_LABELS["loved-one"]

	const [people, setPeople] = useState<Person[]>([])
	const [editing, setEditing] = useState<Person | null>(null)

	useEffect(() => {
		if (!hydrated) return
		const saved = state.data.people
		if (Array.isArray(saved)) setPeople(saved as Person[])
	}, [hydrated, state.data.people])

	const persist = (next: Person[]) => {
		setPeople(next)
		update({ data: { people: next } })
	}

	const startAdd = () =>
		setEditing({ id: newId(), name: "", relationship: "", age: "", description: "" })

	const startEdit = (p: Person) => setEditing({ ...p })

	const remove = (id: string) => persist(people.filter((p) => p.id !== id))

	const saveEdit = (p: Person) => {
		const exists = people.some((x) => x.id === p.id)
		const next = exists
			? people.map((x) => (x.id === p.id ? p : x))
			: [...people, p]
		persist(next)
		setEditing(null)
	}

	const goNext = () => {
		update({ step: "questions" })
		router.push("/onboarding/questions")
	}

	const goSkip = () => {
		update({ step: "questions" })
		router.push("/onboarding/questions")
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

				<header className="mt-6 mb-6">
					<h1 className="mb-3 text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)]">
						Who's in {labels.possessive} world?
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						The people who matter to {labels.subject}. A line about each lets us
						ask better questions — "Tell me about the day David proposed," not
						"Tell me about your husband."
					</p>
				</header>

				{people.length === 0 && !editing && (
					<div className="rounded-2xl border border-dashed border-[color:var(--ember-divider)] bg-[color:var(--ember-cream-light)] px-5 py-4 mb-3">
						<div className="text-base font-semibold text-[color:var(--ember-ink)] mb-1">
							How this works
						</div>
						<p className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
							Add a person, then a sentence or two — their relationship to{" "}
							{labels.subject}, what they're like, anything that might come up
							in {labels.possessive} stories. Mic icon for voice.
						</p>
					</div>
				)}

				<div className="flex flex-col gap-3">
					{people.map((p) =>
						editing?.id === p.id ? (
							<PersonForm
								key={p.id}
								person={editing}
								onChange={setEditing}
								onSave={saveEdit}
								onCancel={() => setEditing(null)}
							/>
						) : (
							<PersonCard
								key={p.id}
								person={p}
								onEdit={() => startEdit(p)}
								onRemove={() => remove(p.id)}
							/>
						),
					)}

					{editing && !people.some((p) => p.id === editing.id) && (
						<PersonForm
							person={editing}
							onChange={setEditing}
							onSave={saveEdit}
							onCancel={() => setEditing(null)}
						/>
					)}

					{!editing && (
						<button
							type="button"
							onClick={startAdd}
							className="w-full rounded-2xl border border-dashed border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] px-5 py-4 text-base text-[color:var(--ember-warm-gray)] transition-colors hover:border-neutral-400 hover:bg-[color:var(--ember-cream-light)]"
						>
							+ Add person
						</button>
					)}
				</div>

				<p className="mt-4 flex items-start gap-1.5 text-sm text-[color:var(--ember-warm-gray)]">
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
						Helps the AI weave them in. Never shared with {labels.subject}{" "}
						directly.
					</span>
				</p>

				<div className="mt-6 flex flex-col gap-3">
					<button
						type="button"
						onClick={goNext}
						className="ember-cta"
					>
						Continue
					</button>
				</div>

				<div className="mt-5 text-center">
					<button
						type="button"
						onClick={goSkip}
						className="text-sm text-[color:var(--ember-warm-gray)] underline underline-offset-2 transition-colors hover:text-[color:var(--ember-warm-gray)]"
					>
						Skip for now
					</button>
				</div>
			</div>
		</main>
	)
}

function PersonCard({
	person,
	onEdit,
	onRemove,
}: {
	person: Person
	onEdit: () => void
	onRemove: () => void
}) {
	const meta = [person.relationship, person.age && `${person.age} yrs`]
		.filter(Boolean)
		.join(" · ")

	return (
		<div className="rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] px-5 py-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="text-base text-[color:var(--ember-ink)]">
						<span className="font-semibold">{person.name}</span>
						{meta && (
							<span className="text-[color:var(--ember-warm-gray)]"> — {meta}</span>
						)}
					</div>
					{person.description && (
						<p className="mt-1 text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
							{person.description}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2 text-sm text-[color:var(--ember-soft-gray)] shrink-0">
					<button
						type="button"
						onClick={onEdit}
						className="hover:text-[color:var(--ember-warm-gray)] transition-colors"
					>
						edit
					</button>
					<span aria-hidden="true">·</span>
					<button
						type="button"
						onClick={onRemove}
						aria-label="Remove person"
						className="hover:text-[color:var(--ember-warm-gray)] transition-colors"
					>
						×
					</button>
				</div>
			</div>
		</div>
	)
}

function PersonForm({
	person,
	onChange,
	onSave,
	onCancel,
}: {
	person: Person
	onChange: (p: Person) => void
	onSave: (p: Person) => void
	onCancel: () => void
}) {
	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const [recError, setRecError] = useState<string | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	const trimmed = {
		name: person.name.trim(),
		relationship: person.relationship.trim(),
		description: person.description.trim(),
	}
	const canSave = Boolean(trimmed.name && trimmed.relationship)

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (!canSave) return
		onSave({
			...person,
			name: trimmed.name,
			relationship: trimmed.relationship,
			age: person.age.trim(),
			description: trimmed.description,
		})
	}

	const startRecording = async () => {
		setRecError(null)
		if (typeof MediaRecorder === "undefined") return
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
			const sep =
				person.description && !person.description.endsWith(" ") ? " " : ""
			onChange({
				...person,
				description: (person.description + sep + text).slice(0, DESC_MAX),
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
		<form
			onSubmit={handleSubmit}
			className="rounded-2xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] px-5 py-4"
		>
			<div className="flex flex-col gap-3">
				<div className="grid grid-cols-[1fr_auto] gap-3">
					<input
						type="text"
						placeholder="Name"
						value={person.name}
						onChange={(e) => onChange({ ...person, name: e.target.value })}
						autoFocus
						className="w-full rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-3 py-2.5 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
					/>
					<input
						type="text"
						inputMode="numeric"
						placeholder="Age"
						value={person.age}
						onChange={(e) => onChange({ ...person, age: e.target.value })}
						className="w-20 rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-3 py-2.5 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
					/>
				</div>

				<input
					type="text"
					placeholder="Relationship (partner, sister, friend…)"
					value={person.relationship}
					onChange={(e) =>
						onChange({ ...person, relationship: e.target.value })
					}
					className="w-full rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] px-3 py-2.5 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none focus:border-neutral-900 transition-colors"
				/>

				<div className="relative rounded-xl border border-[color:var(--ember-divider)] bg-[color:var(--ember-input)] focus-within:border-neutral-900 transition-colors">
					<textarea
						placeholder="A line or two about them"
						value={person.description}
						onChange={(e) =>
							onChange({
								...person,
								description: e.target.value.slice(0, DESC_MAX),
							})
						}
						rows={3}
						disabled={transcribing}
						className="block w-full resize-none rounded-xl bg-transparent px-3 pt-2.5 pb-9 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none disabled:opacity-60"
					/>
					<div className="pointer-events-none absolute left-3 bottom-2.5 text-xs text-[color:var(--ember-soft-gray)]">
						{person.description.length} / {DESC_MAX}
					</div>
					<button
						type="button"
						onClick={toggleRecord}
						disabled={transcribing}
						aria-label={recording ? "Stop recording" : "Record voice note"}
						className={`absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
							recording
								? "border-red-500 bg-red-500"
								: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] hover:bg-neutral-100"
						} disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{transcribing ? (
							<svg
								className="h-3 w-3 animate-spin text-[color:var(--ember-warm-gray)]"
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
								className={`block h-2 w-2 rounded-full ${
									recording ? "bg-[color:var(--ember-card)] animate-pulse" : "bg-neutral-700"
								}`}
							/>
						)}
					</button>
				</div>

				{recError && <p className="text-sm text-red-500">{recError}</p>}

				<div className="flex items-center justify-end gap-3 pt-1">
					<button
						type="button"
						onClick={onCancel}
						className="px-4 py-2 text-sm text-[color:var(--ember-warm-gray)] hover:text-[color:var(--ember-warm-gray)] transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!canSave}
						className="rounded-xl bg-[color:var(--ember-ink)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Save
					</button>
				</div>
			</div>
		</form>
	)
}
