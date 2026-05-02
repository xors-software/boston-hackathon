// In-memory store for Ember domain entities. Mirrors the schema in
// server/src/db/migrations/002_ember_gifts.sql so a Postgres swap can
// replace this module 1:1 without changing the route layer.
//
// WARNING: in-memory only — restart loses every gift, recipient, and
// response. Suitable for hackathon scope and for the API-only PR
// landing voice/photo recipient endpoints.

export type ResponseKind = "text" | "voice" | "photo"

export interface Gift {
	id: string
	userId: string
	intent: "mom" | "dad" | "loved-one" | "undecided"
	about: string
	why: string
	delivery: "email" | "in-person" | null
	recipientName: string | null
	recipientEmail: string | null
	currentStep: string
	status: "draft" | "sent" | "archived"
	sentAt: string | null
	timeLockAt: string | null
	timeLockKind: "date" | "milestone" | "after_passing" | null
	releasedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface Question {
	id: string
	giftId: string
	source: "library" | "custom"
	templateId: string | null
	text: string
	photoUrl: string | null
	preface: string | null
	position: number
	createdAt: string
}

export interface Recipient {
	id: string
	giftId: string
	accessToken: string
	email: string
	name: string
	firstSeenAt: string | null
	lastActiveAt: string | null
}

export interface Response {
	id: string
	giftId: string
	recipientId: string
	questionId: string
	kind: ResponseKind
	text: string | null
	audioUrl: string | null
	photoUrl: string | null
	recordedAt: string
}

const gifts = new Map<string, Gift>()
const questions = new Map<string, Question>()
const recipients = new Map<string, Recipient>()
const responses = new Map<string, Response>()

const recipientByToken = new Map<string, string>() // token -> recipientId

function id(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function _resetForTests(): void {
	gifts.clear()
	questions.clear()
	recipients.clear()
	responses.clear()
	recipientByToken.clear()
}

// ---- gifts ---------------------------------------------------------

export function createGift(input: {
	userId: string
	intent?: Gift["intent"]
}): Gift {
	const now = new Date().toISOString()
	const gift: Gift = {
		id: id("gft"),
		userId: input.userId,
		intent: input.intent ?? "undecided",
		about: "",
		why: "",
		delivery: null,
		recipientName: null,
		recipientEmail: null,
		currentStep: "welcome",
		status: "draft",
		sentAt: null,
		timeLockAt: null,
		timeLockKind: null,
		releasedAt: null,
		createdAt: now,
		updatedAt: now,
	}
	gifts.set(gift.id, gift)
	return gift
}

export function getGiftById(id: string): Gift | null {
	return gifts.get(id) ?? null
}

export function listGiftsForUser(userId: string): Gift[] {
	return Array.from(gifts.values())
		.filter((g) => g.userId === userId)
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

// ---- questions -----------------------------------------------------

export function addQuestion(input: {
	giftId: string
	source: "library" | "custom"
	templateId?: string | null
	text: string
	preface?: string | null
	photoUrl?: string | null
}): Question {
	const existing = listQuestionsForGift(input.giftId)
	const q: Question = {
		id: id("qst"),
		giftId: input.giftId,
		source: input.source,
		templateId: input.templateId ?? null,
		text: input.text,
		photoUrl: input.photoUrl ?? null,
		preface: input.preface ?? null,
		position: existing.length,
		createdAt: new Date().toISOString(),
	}
	questions.set(q.id, q)
	return q
}

export function getQuestionById(id: string): Question | null {
	return questions.get(id) ?? null
}

export function listQuestionsForGift(giftId: string): Question[] {
	return Array.from(questions.values())
		.filter((q) => q.giftId === giftId)
		.sort((a, b) => a.position - b.position)
}

// ---- recipients ----------------------------------------------------

function generateAccessToken(): string {
	// 32 bytes of randomness, hex-encoded → 64 chars. Unguessable for v1.
	const bytes = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

export function createRecipient(input: {
	giftId: string
	email: string
	name: string
}): Recipient {
	const r: Recipient = {
		id: id("rcp"),
		giftId: input.giftId,
		accessToken: generateAccessToken(),
		email: input.email,
		name: input.name,
		firstSeenAt: null,
		lastActiveAt: null,
	}
	recipients.set(r.id, r)
	recipientByToken.set(r.accessToken, r.id)
	return r
}

export function getRecipientByToken(token: string): Recipient | null {
	const rid = recipientByToken.get(token)
	if (!rid) return null
	return recipients.get(rid) ?? null
}

export function touchRecipientActivity(recipientId: string): void {
	const r = recipients.get(recipientId)
	if (!r) return
	const now = new Date().toISOString()
	if (!r.firstSeenAt) r.firstSeenAt = now
	r.lastActiveAt = now
}

// ---- responses -----------------------------------------------------

export interface UpsertResponseInput {
	giftId: string
	recipientId: string
	questionId: string
	kind: ResponseKind
	text?: string | null
	audioUrl?: string | null
	photoUrl?: string | null
}

// One response per (recipient, question). Re-submitting overwrites.
export function upsertResponse(input: UpsertResponseInput): Response {
	const existing = Array.from(responses.values()).find(
		(r) =>
			r.recipientId === input.recipientId && r.questionId === input.questionId,
	)
	const now = new Date().toISOString()
	const next: Response = {
		id: existing?.id ?? id("rsp"),
		giftId: input.giftId,
		recipientId: input.recipientId,
		questionId: input.questionId,
		kind: input.kind,
		text: input.text ?? null,
		audioUrl: input.audioUrl ?? null,
		photoUrl: input.photoUrl ?? null,
		recordedAt: now,
	}
	responses.set(next.id, next)
	return next
}

export function getResponseById(id: string): Response | null {
	return responses.get(id) ?? null
}

export function deleteResponse(id: string): boolean {
	return responses.delete(id)
}

export function listResponsesForGift(giftId: string): Response[] {
	return Array.from(responses.values())
		.filter((r) => r.giftId === giftId)
		.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1))
}

export function listResponsesForRecipient(recipientId: string): Response[] {
	return Array.from(responses.values())
		.filter((r) => r.recipientId === recipientId)
		.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1))
}
