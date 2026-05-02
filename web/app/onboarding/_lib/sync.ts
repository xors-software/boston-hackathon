"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@/hooks/useUser"
import { useCreateGift } from "@/hooks/useGifts"
import { api, unwrap } from "@/lib/api"
import type { OnboardingState } from "./state"

export const GIFT_ID_KEY = "ember:onboarding:giftId"

export function getStoredGiftId(): string | null {
	if (typeof window === "undefined") return null
	try {
		return localStorage.getItem(GIFT_ID_KEY)
	} catch {
		return null
	}
}

export function setStoredGiftId(id: string): void {
	if (typeof window === "undefined") return
	try {
		localStorage.setItem(GIFT_ID_KEY, id)
	} catch {}
}

export function clearStoredGiftId(): void {
	if (typeof window === "undefined") return
	try {
		localStorage.removeItem(GIFT_ID_KEY)
	} catch {}
}

type GiftIntent = "mom" | "dad" | "loved-one" | "undecided"
type GiftDelivery = "email" | "in-person"
type FrontPerson = {
	id: string
	name: string
	relationship: string
	age: string
	description: string
}
type FrontCustomQuestion = {
	id: string
	text: string
	preface?: string
	// Once a question lands on the server we keep its returned id here
	// so re-syncs don't keep recreating it. Photos are uploaded directly
	// from the write page (multipart → S3) and stored as URLs server-side,
	// never inlined into the local snapshot.
	serverId?: string
	photoUrl?: string
}
type FrontQuestionsState = {
	selectedIds: string[]
	custom: FrontCustomQuestion[]
	edits?: Record<string, string>
}

const VALID_INTENTS: ReadonlySet<GiftIntent> = new Set([
	"mom",
	"dad",
	"loved-one",
	"undecided",
])

function asIntent(v: unknown): GiftIntent | undefined {
	return typeof v === "string" && VALID_INTENTS.has(v as GiftIntent)
		? (v as GiftIntent)
		: undefined
}

function asDelivery(v: unknown): GiftDelivery | undefined {
	if (v === "email" || v === "in-person") return v
	return undefined
}

// Pushes flat gift fields. Cheap; safe to call frequently.
async function patchGiftFields(
	giftId: string,
	state: OnboardingState,
): Promise<void> {
	const data = state.data
	const patch: Record<string, unknown> = {}
	const intent = asIntent(data.intent)
	if (intent) patch.intent = intent
	if (typeof data.about === "string") patch.about = data.about
	if (typeof data.why === "string") patch.why = data.why
	const delivery = asDelivery(data.delivery)
	if (delivery) patch.delivery = delivery
	if (typeof data.recipientName === "string")
		patch.recipientName = data.recipientName
	if (typeof data.recipientEmail === "string")
		patch.recipientEmail = data.recipientEmail
	if (state.step) patch.currentStep = state.step
	if (Object.keys(patch).length === 0) return
	await unwrap(api.gifts({ id: giftId }).patch(patch))
}

async function syncPeople(
	giftId: string,
	state: OnboardingState,
): Promise<void> {
	const raw = state.data.people
	if (!Array.isArray(raw)) return
	const people = (raw as FrontPerson[]).map((p) => ({
		id: p.id,
		name: p.name,
		relationship: p.relationship,
		age: p.age ?? "",
		description: p.description ?? "",
	}))
	await unwrap(api.gifts({ id: giftId }).people.put({ people }))
}

// Wipes server-side questions and re-creates from current local state.
// Only fires at send-time, so the wasteful pattern is acceptable until
// per-question incremental sync lands.
async function syncQuestions(
	giftId: string,
	state: OnboardingState,
): Promise<void> {
	const qs = state.data.questions as FrontQuestionsState | undefined
	if (!qs) return

	const { questions: current } = await unwrap(
		api.gifts({ id: giftId }).questions.get(),
	)
	for (const existing of current) {
		await unwrap(
			api
				.gifts({ id: giftId })
				.questions({ qid: existing.id })
				.delete(),
		)
	}

	const customById = new Map(qs.custom.map((c) => [c.id, c]))
	for (const id of qs.selectedIds) {
		const custom = customById.get(id)
		if (custom) {
			// Photos were uploaded directly from the write page; we forward
			// the resulting URL on re-create so the photo survives the
			// wipe-and-recreate sync that runs at send-time.
			await unwrap(
				api.gifts({ id: giftId }).questions.post({
					source: "custom",
					text: custom.text,
					preface: custom.preface ?? null,
					photoUrl: custom.photoUrl ?? null,
				}),
			)
		} else {
			const editedText = qs.edits?.[id]
			await unwrap(
				api.gifts({ id: giftId }).questions.post({
					source: "library",
					templateId: id,
					text: editedText,
				}),
			)
		}
	}
}

export async function syncGiftSnapshot(
	giftId: string,
	state: OnboardingState,
): Promise<void> {
	await patchGiftFields(giftId, state)
	await syncPeople(giftId, state)
	await syncQuestions(giftId, state)
}

// Creates a draft gift on first authed mount if one doesn't already
// exist locally. Carries any pre-auth `intent` choice into the POST.
export function useEnsureGift(state: OnboardingState | null): {
	giftId: string | null
	creating: boolean
	error: Error | null
} {
	const { data: user } = useUser()
	const createGift = useCreateGift()
	const startedRef = useRef(false)
	const [giftId, setGiftId] = useState<string | null>(() => getStoredGiftId())

	useEffect(() => {
		if (!user || !state) return
		if (giftId) return
		if (startedRef.current) return
		startedRef.current = true
		const intent = asIntent(state.data.intent)
		createGift.mutate(
			{ intent },
			{
				onSuccess: (result) => {
					setStoredGiftId(result.gift.id)
					setGiftId(result.gift.id)
				},
				onError: () => {
					startedRef.current = false
				},
			},
		)
	}, [user, state, giftId, createGift])

	return {
		giftId,
		creating: createGift.isPending,
		error: (createGift.error as Error | null) ?? null,
	}
}
