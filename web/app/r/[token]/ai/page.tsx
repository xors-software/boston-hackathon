"use client"

import { useParams, useRouter } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { type JournalEntry, newEntryId } from "../_lib/entries"
import { isArchived } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

type ChatMessage = { role: "user" | "assistant"; content: string }

export default function ParentAiChatPage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, update, hydrated } = useParentState(token)

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState("")
	const [sending, setSending] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const [recording, setRecording] = useState(false)
	const [transcribing, setTranscribing] = useState(false)
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])

	const scrollRef = useRef<HTMLDivElement>(null)
	const initRef = useRef(false)

	const userTurns = messages.filter((m) => m.role === "user").length
	const archived = hydrated && isArchived(state.data)

	// Stable across renders so the effect below doesn't re-fire on
	// every render; only set-state from React, no other deps.
	const converse = useCallback(async (history: ChatMessage[]) => {
		setSending(true)
		setError(null)
		try {
			const res = await fetch(`/api/ai/converse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					topic: "parent-reflect",
					messages: history,
					intent: "n/a",
				}),
			})
			const data = (await res.json()) as { message?: string; error?: string }
			if (!res.ok || !data.message) {
				setError(data.error || "Couldn't reach Ember.")
				return
			}
			setMessages([...history, { role: "assistant", content: data.message }])
		} catch {
			setError("Couldn't reach Ember.")
		} finally {
			setSending(false)
		}
	}, [])

	// Open with the first AI message
	useEffect(() => {
		if (!hydrated || initRef.current) return
		initRef.current = true
		void converse([])
	}, [hydrated, converse])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
	}, [])

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault()
		const text = input.trim()
		if (!text || sending) return
		const next: ChatMessage[] = [...messages, { role: "user", content: text }]
		setMessages(next)
		setInput("")
		await converse(next)
	}

	const saveAsEntry = async () => {
		if (userTurns === 0) return
		setSaving(true)
		setError(null)
		try {
			const res = await fetch(`/api/ai/summarize`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ topic: "parent-reflect", messages }),
			})
			const data = (await res.json()) as { summary?: string; error?: string }
			if (!res.ok) {
				setError(data.error || "Couldn't save the conversation.")
				return
			}
			const summary = (data.summary || "").trim()
			if (!summary) {
				setError("Nothing to save yet — chat a bit more first.")
				return
			}
			const entries =
				(state.data.entries as JournalEntry[] | undefined) ?? []
			const entry: JournalEntry = {
				id: newEntryId(),
				createdAt: new Date().toISOString(),
				source: "ai",
				text: summary,
			}
			update({ data: { entries: [entry, ...entries] } })
			router.push(`/r/${token}/journal`)
		} catch {
			setError("Couldn't save the conversation.")
		} finally {
			setSaving(false)
		}
	}

	// ─── voice ───
	const startRecording = async () => {
		setError(null)
		if (typeof MediaRecorder === "undefined") return
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
			const text = (data.text || "").trim()
			if (!text) return
			setInput((prev) => (prev ? `${prev} ${text}` : text))
		} catch {
			setError("Couldn't reach the transcription service.")
		} finally {
			setTranscribing(false)
		}
	}

	const toggleRecord = () => {
		if (transcribing || sending) return
		recording ? stopRecording() : startRecording()
	}

	return (
		<main
			className="min-h-dvh w-full flex flex-col"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 pt-6 pb-6 sm:px-8">
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
						onClick={saveAsEntry}
						disabled={userTurns === 0 || saving || sending || archived}
						className="text-sm font-medium text-[color:var(--ember-ink)] underline underline-offset-2 transition-colors hover:text-[color:var(--ember-warm-gray)] disabled:text-[color:var(--ember-soft-gray)] disabled:no-underline disabled:cursor-not-allowed"
					>
						{saving ? "Saving…" : "Save as entry →"}
					</button>
				</div>

				<header className="mt-4 mb-5">
					<p
						className="text-[11px] font-medium tracking-[0.22em] uppercase mb-2"
						style={{ color: "var(--ember-terracotta)" }}
					>
						Talk it through
					</p>
					<h1 className="font-serif text-[40px] sm:text-[44px] tracking-tight leading-[1.05] text-[color:var(--ember-ink)] mb-2">
						Tell me what's on your <span className="italic" style={{ color: "var(--ember-terracotta)" }}>mind</span>.
					</h1>
					<p className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
						I'll keep you company. When you're ready, save what you said as a
						journal entry.
					</p>
				</header>

				<div
					ref={scrollRef}
					className="flex-1 min-h-[200px] overflow-y-auto flex flex-col gap-3 pb-1"
				>
					{messages.map((m, i) =>
						m.role === "assistant" ? (
							<div
								key={i}
								className="self-start max-w-[85%] rounded-2xl bg-[color:var(--ember-card)] px-4 py-3"
							>
								<div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--ember-soft-gray)] mb-1">
									Ember
								</div>
								<div className="text-base text-[color:var(--ember-ink)] leading-relaxed whitespace-pre-wrap">
									{m.content}
								</div>
							</div>
						) : (
							<div
								key={i}
								className="self-end max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-3"
							>
								<div className="text-base text-white leading-relaxed whitespace-pre-wrap">
									{m.content}
								</div>
							</div>
						),
					)}
					{sending && (
						<div className="self-start text-sm italic text-[color:var(--ember-soft-gray)] pl-1">
							typing…
						</div>
					)}
				</div>

				{error && <p className="mt-2 text-sm text-red-500">{error}</p>}

				<form
					onSubmit={onSubmit}
					className="relative mt-4 rounded-2xl border border-[color:var(--ember-divider)]/60 bg-[color:var(--ember-input)] focus-within:border-neutral-900 transition-colors"
				>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={
							transcribing ? "Transcribing…" : "Type your reply..."
						}
						disabled={transcribing || saving}
						className="block w-full rounded-2xl bg-transparent pl-4 pr-12 py-3.5 text-base text-[color:var(--ember-ink)] placeholder:text-[color:var(--ember-soft-gray)] outline-none disabled:opacity-60"
					/>
					<button
						type="button"
						onClick={toggleRecord}
						disabled={transcribing || sending || saving}
						aria-label={recording ? "Stop recording" : "Record voice reply"}
						className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
							recording
								? "border-red-500 bg-red-500"
								: "border-[color:var(--ember-divider)] bg-[color:var(--ember-card)] hover:bg-neutral-100"
						} disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{transcribing ? (
							<svg
								className="h-3.5 w-3.5 animate-spin text-[color:var(--ember-warm-gray)]"
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
								className={`block h-2.5 w-2.5 rounded-full ${
									recording ? "bg-[color:var(--ember-card)] animate-pulse" : "bg-neutral-700"
								}`}
							/>
						)}
					</button>
				</form>

				<button
					type="button"
					onClick={saveAsEntry}
					disabled={userTurns === 0 || saving || sending || archived}
					className="mt-3 ember-cta disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{saving ? "Saving…" : "Save this as a journal entry"}
				</button>

				<p className="mt-3 text-center text-xs text-[color:var(--ember-warm-gray)]">
					Private to you. Nothing leaves until you say so.
				</p>
			</div>
		</main>
	)
}
