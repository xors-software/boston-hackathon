"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { api, ApiError, unwrap } from "@/lib/api"
import { useOnboardingState } from "../_lib/state"
import { getStoredGiftId, syncGiftSnapshot } from "../_lib/sync"

const RECIPIENT_DEFAULTS: Record<
	string,
	{ name: string; subject: string; possessive: string }
> = {
	mom: { name: "Mom", subject: "her", possessive: "her" },
	dad: { name: "Dad", subject: "him", possessive: "his" },
	"loved-one": { name: "Them", subject: "them", possessive: "their" },
	undecided: { name: "Them", subject: "them", possessive: "their" },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CustomQuestion = { id: string; text: string }
type QuestionsState = {
	selectedIds: string[]
	custom: CustomQuestion[]
	edits?: Record<string, string>
}

export default function SendPage() {
	const router = useRouter()
	const { state, update, hydrated } = useOnboardingState()

	const intent = (state.data.intent as string | undefined) ?? "loved-one"
	const labels = RECIPIENT_DEFAULTS[intent] ?? RECIPIENT_DEFAULTS["loved-one"]
	const delivery =
		(state.data.delivery as "email" | "in-person" | undefined) ?? "email"

	const [recipientName, setRecipientName] = useState(labels.name)
	const [recipientEmail, setRecipientEmail] = useState("")
	const [draftName, setDraftName] = useState(labels.name)
	const [draftEmail, setDraftEmail] = useState("")
	const [editingFor, setEditingFor] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)
	const [sending, setSending] = useState(false)
	const [sendError, setSendError] = useState<string | null>(null)

	useEffect(() => {
		if (!hydrated) return
		const savedName = state.data.recipientName as string | undefined
		const savedEmail = state.data.recipientEmail as string | undefined
		if (savedName) {
			setRecipientName(savedName)
			setDraftName(savedName)
		}
		if (savedEmail) {
			setRecipientEmail(savedEmail)
			setDraftEmail(savedEmail)
		}
	}, [hydrated, state.data.recipientName, state.data.recipientEmail])

	const questions = state.data.questions as QuestionsState | undefined
	const questionsCount = questions?.selectedIds.length ?? 0

	const deliveryLabel = delivery === "email" ? "Email" : "In person"
	const needsEmail = delivery === "email"
	const emailValid = !needsEmail || EMAIL_RE.test(recipientEmail.trim())
	const canSend = questionsCount > 0 && emailValid

	const previewLine = useMemo(
		() =>
			`"${recipientName} — I made you something. Open when you have a quiet minute."`,
		[recipientName],
	)

	const openEditFor = () => {
		setDraftName(recipientName)
		setDraftEmail(recipientEmail)
		setEditingFor(true)
	}

	const cancelEditFor = () => setEditingFor(false)

	const saveEditFor = (e: FormEvent) => {
		e.preventDefault()
		const name = draftName.trim() || labels.name
		const email = draftEmail.trim()
		setRecipientName(name)
		setRecipientEmail(email)
		update({ data: { recipientName: name, recipientEmail: email } })
		setEditingFor(false)
	}

	const editDelivery = () => router.push("/onboarding/delivery")
	const editQuestions = () => router.push("/onboarding/questions/review")

	const goSaveLater = () => {
		router.push("/")
	}

	const submitSend = async () => {
		setSendError(null)
		setSending(true)
		try {
			const giftId = getStoredGiftId()
			if (!giftId) {
				throw new Error("Gift not initialized — sign in again to retry.")
			}
			// Snapshot the current local state to the API before sending,
			// since intermediate steps haven't been syncing incrementally.
			const snapshotState = {
				step: "send" as const,
				data: {
					...state.data,
					recipientName,
					recipientEmail,
				},
			}
			await syncGiftSnapshot(giftId, snapshotState)
			const result = await unwrap(api.gifts({ id: giftId }).send.post())
			const sentAt = result.gift.sentAt ?? new Date().toISOString()
			update({
				step: "complete",
				data: {
					recipientName: result.gift.recipientName,
					recipientEmail: result.gift.recipientEmail ?? recipientEmail,
					sentAt,
					recipientToken: result.recipient.accessToken,
				},
			})
			router.push("/onboarding/sent")
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Send failed"
			setSendError(message)
			setSending(false)
		}
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
						Ready to send.
					</h1>
					<p className="text-base text-neutral-500 leading-relaxed">
						Here's what arrives in their inbox.
					</p>
				</header>

				<div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center mb-4">
					<div className="flex justify-center mb-4">
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-8 w-8 text-neutral-500"
						>
							<rect x="3" y="5" width="18" height="14" rx="2" />
							<polyline points="3 7 12 13 21 7" />
						</svg>
					</div>
					<div className="text-base font-semibold text-neutral-900 mb-2">
						Preview — email invitation
					</div>
					<p className="text-sm text-neutral-600 leading-relaxed">
						{previewLine}
					</p>
				</div>

				<div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-200">
					<SummaryRow
						label="For"
						value={recipientName}
						onEdit={openEditFor}
						expanded={editingFor}
					>
						{editingFor && (
							<form onSubmit={saveEditFor} className="mt-3 flex flex-col gap-3">
								<label className="flex flex-col gap-1.5">
									<span className="text-xs font-medium text-neutral-600">
										Name
									</span>
									<input
										type="text"
										value={draftName}
										onChange={(e) => setDraftName(e.target.value)}
										autoFocus
										className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-neutral-900 transition-colors"
									/>
								</label>
								{needsEmail && (
									<label className="flex flex-col gap-1.5">
										<span className="text-xs font-medium text-neutral-600">
											Email
										</span>
										<input
											type="email"
											inputMode="email"
											placeholder="them@example.com"
											value={draftEmail}
											onChange={(e) => setDraftEmail(e.target.value)}
											className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 transition-colors"
										/>
									</label>
								)}
								<div className="flex items-center justify-end gap-3 pt-1">
									<button
										type="button"
										onClick={cancelEditFor}
										className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700"
									>
										Save
									</button>
								</div>
							</form>
						)}
					</SummaryRow>
					<SummaryRow
						label="Delivery"
						value={deliveryLabel}
						onEdit={editDelivery}
					/>
					<SummaryRow
						label="Questions"
						value={`${questionsCount} included`}
						onEdit={editQuestions}
					/>
				</div>

				{needsEmail && !emailValid && (
					<p className="mt-3 text-sm text-neutral-500">
						Add {labels.possessive} email above to send.
					</p>
				)}

				{sendError && (
					<p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{sendError}
					</p>
				)}

				<div className="mt-8 flex flex-col gap-3">
					<button
						type="button"
						onClick={() => setShowConfirm(true)}
						disabled={!canSend}
						className="w-full rounded-2xl bg-neutral-900 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Send it
					</button>
					<button
						type="button"
						onClick={goSaveLater}
						className="text-center text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors py-2"
					>
						Save for later
					</button>
				</div>
			</div>

			{showConfirm && (
				<ConfirmDialog
					recipientName={recipientName}
					subject={labels.subject}
					sending={sending}
					onCancel={() => setShowConfirm(false)}
					onConfirm={submitSend}
				/>
			)}
		</main>
	)
}

function SummaryRow({
	label,
	value,
	onEdit,
	expanded,
	children,
}: {
	label: string
	value: string
	onEdit: () => void
	expanded?: boolean
	children?: React.ReactNode
}) {
	return (
		<div className="px-5 py-4">
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-neutral-500">{label}</span>
				<div className="flex items-center gap-3">
					<span className="text-base font-semibold text-neutral-900">
						{value}
					</span>
					<button
						type="button"
						onClick={onEdit}
						aria-expanded={expanded}
						className="text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors"
					>
						edit
					</button>
				</div>
			</div>
			{children}
		</div>
	)
}

function ConfirmDialog({
	recipientName,
	subject,
	sending,
	onCancel,
	onConfirm,
}: {
	recipientName: string
	subject: string
	sending: boolean
	onCancel: () => void
	onConfirm: () => void
}) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="send-confirm-title"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
		>
			<div className="w-full max-w-sm rounded-3xl bg-white px-6 py-7 text-center shadow-xl">
				<h2
					id="send-confirm-title"
					className="text-xl font-semibold text-neutral-900 mb-3"
				>
					Send this gift to {recipientName}?
				</h2>
				<p className="text-sm text-neutral-500 leading-relaxed mb-6">
					{capitalize(subject)}'ll get an invitation by email. You can keep
					adding questions after {subject} opens it.
				</p>
				<div className="flex flex-col gap-3">
					<button
						type="button"
						onClick={onConfirm}
						disabled={sending}
						className="w-full rounded-2xl bg-neutral-900 py-3.5 text-base font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-60"
					>
						{sending ? "Sending…" : "Send"}
					</button>
					<button
						type="button"
						onClick={onCancel}
						disabled={sending}
						className="text-center text-sm text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors py-1 disabled:opacity-60"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	)
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}
