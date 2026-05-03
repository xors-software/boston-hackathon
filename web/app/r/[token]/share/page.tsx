"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { AvatarMenu } from "../_components/AvatarMenu"
import { BottomTabs } from "../_components/BottomTabs"
import type { JournalEntry } from "../_lib/entries"
import { isArchived, readSharing, sharingDisplay } from "../_lib/sharing"
import { useParentState } from "../_lib/state"

// Backend: from GET /r/:token. Hardcoded for now.
const MOCK_GIVER = {
	name: "Sofia",
	pronoun: { subject: "she", possessive: "her", object: "her" },
}

export default function SharePage() {
	const router = useRouter()
	const params = useParams()
	const token = (params.token as string) ?? ""
	const { state, hydrated, update } = useParentState(token)

	const [confirmOpen, setConfirmOpen] = useState(false)
	const [sharingNow, setSharingNow] = useState(false)

	if (!hydrated) return null

	const sharing = readSharing(state.data)
	const display = sharingDisplay(sharing)
	const giver = MOCK_GIVER
	const initial =
		(state.data.email as string | undefined)?.[0]?.toUpperCase() ?? "M"
	const entries =
		(state.data.entries as JournalEntry[] | undefined) ?? []

	const confirmShareNow = () => {
		setSharingNow(true)
		const now = new Date().toISOString()
		update({
			data: {
				sharing: {
					...sharing,
					sharedAt: now,
					lastSharedSnapshotCount: entries.length,
				},
			},
		})
		setSharingNow(false)
		setConfirmOpen(false)
		router.push(`/r/${token}/share/done`)
	}

	return (
		<main
			className="min-h-dvh w-full"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div className="mx-auto w-full max-w-md px-6 pt-6 pb-32 sm:px-8">
				<div className="flex items-center justify-end">
					<AvatarMenu initial={initial} />
				</div>

				<header className="mt-10 mb-8">
					<p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[color:var(--ember-warm-gray)] mb-3">
						Settings · Sharing
					</p>
					<h1 className="text-3xl sm:text-[32px] font-semibold tracking-tight leading-tight text-[color:var(--ember-ink)] mb-4">
						Sharing
					</h1>
					<p className="text-base text-[color:var(--ember-warm-gray)] leading-relaxed">
						Your journal is yours, ongoing, for as long as you keep writing.
						There's no end — but if and when you'd like to share what you've
						gathered, you can do it from here.
					</p>
				</header>

				<div className="rounded-2xl bg-[color:var(--ember-card)] px-5 py-4 mb-3">
					<p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[color:var(--ember-warm-gray)] mb-1">
						Currently set to
					</p>
					<p className="text-base font-semibold text-[color:var(--ember-ink)]">
						{display.title}
					</p>
					<p className="mt-1 text-sm text-[color:var(--ember-warm-gray)]">{display.sub}</p>
				</div>

				{!sharing.sharedAt ? (
					<>
						<button
							type="button"
							onClick={() => router.push(`/r/${token}/share/when`)}
							className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--ember-card)] px-5 py-4 text-base text-[color:var(--ember-ink)] transition-colors hover:bg-[color:var(--ember-cream-light)] active:bg-neutral-100"
						>
							<span>Change how this is shared</span>
							<span className="text-[color:var(--ember-soft-gray)]" aria-hidden="true">
								›
							</span>
						</button>

						<button
							type="button"
							onClick={() => setConfirmOpen(true)}
							className="mt-8 ember-cta"
						>
							Share what I've written so far
						</button>

						<p className="mt-4 text-center text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
							Sharing is one-time — your journal will be archived afterwards.
							You'll always be able to read it.
						</p>
					</>
				) : (
					<div className="mt-2 rounded-2xl bg-[color:var(--ember-card)] px-5 py-5">
						<p
							className="text-[10px] font-medium tracking-[0.18em] uppercase mb-2"
							style={{ color: "var(--ember-terracotta)" }}
						>
							Archived
						</p>
						<p className="text-base font-semibold text-[color:var(--ember-ink)] mb-1">
							Shared with {giver.name} on{" "}
							{new Intl.DateTimeFormat("en-US", {
								month: "long",
								day: "numeric",
								year: "numeric",
							}).format(new Date(sharing.sharedAt))}
						</p>
						<p className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed">
							{typeof sharing.lastSharedSnapshotCount === "number" &&
								`${sharing.lastSharedSnapshotCount} ${sharing.lastSharedSnapshotCount === 1 ? "entry" : "entries"} sent. `}
							Your journal is read-only now.
						</p>
					</div>
				)}

			</div>

			{confirmOpen && (
				<ShareConfirmDialog
					giverName={giver.name}
					object={giver.pronoun.object}
					sharing={sharingNow}
					onConfirm={confirmShareNow}
					onCancel={() => setConfirmOpen(false)}
				/>
			)}

			<BottomTabs token={token} active="share" />
		</main>
	)
}

function ShareConfirmDialog({
	giverName,
	object,
	sharing,
	onConfirm,
	onCancel,
}: {
	giverName: string
	object: string
	sharing: boolean
	onConfirm: () => void
	onCancel: () => void
}) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="share-confirm-title"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
		>
			<div className="w-full max-w-sm rounded-3xl bg-[color:var(--ember-card)] px-6 py-7 text-center shadow-xl">
				<p
					className="text-[11px] font-medium tracking-[0.22em] uppercase mb-3"
					style={{ color: "var(--ember-terracotta)" }}
				>
					Sharing
				</p>
				<h2
					id="share-confirm-title"
					className="text-xl font-semibold text-[color:var(--ember-ink)] mb-3"
				>
					Share with {giverName} now?
				</h2>
				<p className="text-sm text-[color:var(--ember-warm-gray)] leading-relaxed mb-6">
					Everything you've written, your voice notes, and your photos will be
					released to {object}. This can't be undone.
				</p>
				<div className="flex flex-col gap-3">
					<button
						type="button"
						onClick={onConfirm}
						disabled={sharing}
						className="ember-cta"
					>
						{sharing ? "Sharing…" : "Yes, share it"}
					</button>
					<button
						type="button"
						onClick={onCancel}
						disabled={sharing}
						className="text-sm text-[color:var(--ember-warm-gray)] underline underline-offset-2 hover:text-[color:var(--ember-ink)] transition-colors py-1 disabled:opacity-60"
					>
						Not yet
					</button>
				</div>
			</div>
		</div>
	)
}

function formatRelative(iso: string): string {
	try {
		const then = new Date(iso).getTime()
		const now = Date.now()
		const mins = Math.floor((now - then) / 60_000)
		if (mins < 1) return "just now"
		if (mins < 60) return `${mins} min ago`
		const hours = Math.floor(mins / 60)
		if (hours < 24) return `${hours}h ago`
		const days = Math.floor(hours / 24)
		if (days < 7) return `${days}d ago`
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
		}).format(new Date(iso))
	} catch {
		return ""
	}
}
