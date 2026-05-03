import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
	gifts as giftsTable,
	people as peopleTable,
	questions as questionsTable,
	recipients as recipientsTable,
	responses as responsesTable,
} from "../db/schema";
import { genId, genToken } from "./ids";

export type GiftIntent = "mom" | "dad" | "loved-one" | "undecided";
export type GiftDelivery = "email" | "in-person";
export type GiftStatus = "draft" | "sent" | "archived";
export type OnboardingStep =
	| "welcome"
	| "intent"
	| "account"
	| "recipient"
	| "why"
	| "world"
	| "questions"
	| "delivery"
	| "send"
	| "complete";

export interface Person {
	id: string;
	giftId: string;
	name: string;
	relationship: string;
	age: string;
	description: string;
	position: number;
}

export type QuestionSource = "library" | "custom" | "ai";

export interface Question {
	id: string;
	giftId: string;
	source: QuestionSource;
	templateId: string | null;
	text: string;
	photoUrl: string | null;
	preface: string | null;
	position: number;
	createdAt: string;
}

export interface Recipient {
	id: string;
	giftId: string;
	accessToken: string;
	email: string;
	name: string;
	firstSeenAt: string | null;
	lastActiveAt: string | null;
}

export type ResponseKind = "text" | "voice" | "photo";

export interface Response {
	id: string;
	giftId: string;
	recipientId: string;
	questionId: string;
	kind: ResponseKind;
	text: string | null;
	audioUrl: string | null;
	photoUrl: string | null;
	recordedAt: string;
}

export interface Gift {
	id: string;
	userId: string;
	intent: GiftIntent;
	about: string;
	why: string;
	delivery: GiftDelivery;
	recipientName: string;
	recipientEmail: string | null;
	currentStep: OnboardingStep;
	status: GiftStatus;
	sentAt: string | null;
	timeLockAt: string | null;
	releasedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

const DEFAULT_RECIPIENT_NAME: Record<GiftIntent, string> = {
	mom: "Mom",
	dad: "Dad",
	"loved-one": "Them",
	undecided: "Them",
};

function isoOrNull(d: Date | null | undefined): string | null {
	return d ? d.toISOString() : null;
}

type DbGift = typeof giftsTable.$inferSelect;
type DbPerson = typeof peopleTable.$inferSelect;
type DbQuestion = typeof questionsTable.$inferSelect;
type DbRecipient = typeof recipientsTable.$inferSelect;
type DbResponse = typeof responsesTable.$inferSelect;

function rowToGift(row: DbGift): Gift {
	return {
		id: row.id,
		userId: row.xorsUserId,
		intent: row.intent,
		about: row.about,
		why: row.why,
		delivery: row.delivery,
		recipientName: row.recipientName,
		recipientEmail: row.recipientEmail,
		currentStep: row.currentStep,
		status: row.status,
		sentAt: isoOrNull(row.sentAt),
		timeLockAt: isoOrNull(row.timeLockAt),
		releasedAt: isoOrNull(row.releasedAt),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function rowToPerson(row: DbPerson): Person {
	return {
		id: row.id,
		giftId: row.giftId,
		name: row.name,
		relationship: row.relationship,
		age: row.age,
		description: row.description,
		position: row.position,
	};
}

function rowToQuestion(row: DbQuestion): Question {
	return {
		id: row.id,
		giftId: row.giftId,
		source: row.source,
		templateId: row.templateId,
		text: row.text,
		photoUrl: row.photoUrl,
		preface: row.preface,
		position: row.position,
		createdAt: row.createdAt.toISOString(),
	};
}

function rowToRecipient(row: DbRecipient): Recipient {
	return {
		id: row.id,
		giftId: row.giftId,
		accessToken: row.accessToken,
		email: row.email,
		name: row.name,
		firstSeenAt: isoOrNull(row.firstSeenAt),
		lastActiveAt: isoOrNull(row.lastActiveAt),
	};
}

function rowToResponse(row: DbResponse): Response {
	return {
		id: row.id,
		giftId: row.giftId,
		recipientId: row.recipientId,
		questionId: row.questionId,
		kind: row.kind,
		text: row.text,
		audioUrl: row.audioUrl,
		photoUrl: row.photoUrl,
		recordedAt: row.recordedAt.toISOString(),
	};
}

// Copies each key from `source` to `target` if the source value is
// defined. Source and target can differ — only fields they share by
// name *and* compatible value type may be passed in `keys`.
function assignDefined<
	T extends object,
	S extends object,
	K extends keyof T & keyof S,
>(target: Partial<T>, source: Partial<S>, keys: readonly K[]): void {
	for (const k of keys) {
		const v = source[k];
		if (v !== undefined) {
			(target as Partial<Record<K, S[K]>>)[k] = v;
		}
	}
}

export async function createGift(
	xorsUserId: string,
	intent?: GiftIntent,
): Promise<Gift> {
	const i = intent ?? "undecided";
	const [row] = await db
		.insert(giftsTable)
		.values({
			id: genId("gft"),
			xorsUserId,
			intent: i,
			recipientName: DEFAULT_RECIPIENT_NAME[i],
		})
		.returning();
	return rowToGift(row);
}

export async function listGiftsForUser(xorsUserId: string): Promise<Gift[]> {
	const rows = await db
		.select()
		.from(giftsTable)
		.where(eq(giftsTable.xorsUserId, xorsUserId))
		.orderBy(desc(giftsTable.createdAt));
	return rows.map(rowToGift);
}

export async function getGift(
	id: string,
	xorsUserId: string,
): Promise<Gift | null> {
	const [row] = await db
		.select()
		.from(giftsTable)
		.where(and(eq(giftsTable.id, id), eq(giftsTable.xorsUserId, xorsUserId)));
	return row ? rowToGift(row) : null;
}

export type GiftPatch = Partial<
	Pick<
		Gift,
		| "intent"
		| "about"
		| "why"
		| "delivery"
		| "recipientName"
		| "recipientEmail"
		| "currentStep"
		| "timeLockAt"
	>
>;

export async function patchGift(
	id: string,
	xorsUserId: string,
	patch: GiftPatch,
): Promise<Gift | null> {
	const update: Partial<typeof giftsTable.$inferInsert> = {
		updatedAt: new Date(),
	};
	assignDefined(update, patch, [
		"intent",
		"about",
		"why",
		"delivery",
		"recipientName",
		"recipientEmail",
		"currentStep",
	]);
	if (patch.timeLockAt !== undefined) {
		update.timeLockAt = patch.timeLockAt ? new Date(patch.timeLockAt) : null;
	}

	const [row] = await db
		.update(giftsTable)
		.set(update)
		.where(and(eq(giftsTable.id, id), eq(giftsTable.xorsUserId, xorsUserId)))
		.returning();
	return row ? rowToGift(row) : null;
}

export async function deleteGift(
	id: string,
	xorsUserId: string,
): Promise<boolean> {
	const existing = await getGift(id, xorsUserId);
	if (!existing) return false;
	if (existing.status === "draft") {
		await db.delete(giftsTable).where(eq(giftsTable.id, id));
	} else {
		await db
			.update(giftsTable)
			.set({ status: "archived", updatedAt: new Date() })
			.where(eq(giftsTable.id, id));
	}
	return true;
}

export async function listPeople(giftId: string): Promise<Person[]> {
	const rows = await db
		.select()
		.from(peopleTable)
		.where(eq(peopleTable.giftId, giftId))
		.orderBy(asc(peopleTable.position));
	return rows.map(rowToPerson);
}

async function nextPosition(
	table: typeof peopleTable | typeof questionsTable,
	giftId: string,
): Promise<number> {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${table.position}), -1) + 1` })
		.from(table)
		.where(eq(table.giftId, giftId));
	return Number(next);
}

export async function addPerson(
	giftId: string,
	input: Omit<Person, "id" | "giftId" | "position">,
): Promise<Person> {
	const position = await nextPosition(peopleTable, giftId);
	const [row] = await db
		.insert(peopleTable)
		.values({
			id: genId("p"),
			giftId,
			name: input.name,
			relationship: input.relationship,
			age: input.age,
			description: input.description,
			position,
		})
		.returning();
	return rowToPerson(row);
}

export async function patchPerson(
	giftId: string,
	pid: string,
	patch: Partial<Pick<Person, "name" | "relationship" | "age" | "description">>,
): Promise<Person | null> {
	const update: Partial<typeof peopleTable.$inferInsert> = {};
	assignDefined(update, patch, ["name", "relationship", "age", "description"]);
	if (Object.keys(update).length === 0) {
		const [row] = await db
			.select()
			.from(peopleTable)
			.where(and(eq(peopleTable.giftId, giftId), eq(peopleTable.id, pid)));
		return row ? rowToPerson(row) : null;
	}
	const [row] = await db
		.update(peopleTable)
		.set(update)
		.where(and(eq(peopleTable.giftId, giftId), eq(peopleTable.id, pid)))
		.returning();
	return row ? rowToPerson(row) : null;
}

export async function deletePerson(
	giftId: string,
	pid: string,
): Promise<boolean> {
	const [removed] = await db
		.delete(peopleTable)
		.where(and(eq(peopleTable.giftId, giftId), eq(peopleTable.id, pid)))
		.returning({ position: peopleTable.position });
	if (!removed) return false;
	await db
		.update(peopleTable)
		.set({ position: sql`${peopleTable.position} - 1` })
		.where(
			and(
				eq(peopleTable.giftId, giftId),
				gt(peopleTable.position, removed.position),
			),
		);
	return true;
}

export async function replacePeople(
	giftId: string,
	people: Array<Omit<Person, "id" | "giftId" | "position"> & { id?: string }>,
): Promise<Person[]> {
	return db.transaction(async (tx) => {
		await tx.delete(peopleTable).where(eq(peopleTable.giftId, giftId));
		if (people.length === 0) return [];
		const inserted = await tx
			.insert(peopleTable)
			.values(
				people.map((p, i) => ({
					id: p.id?.startsWith("p_") ? p.id : genId("p"),
					giftId,
					name: p.name,
					relationship: p.relationship,
					age: p.age ?? "",
					description: p.description ?? "",
					position: i,
				})),
			)
			.returning();
		return inserted
			.sort((a, b) => a.position - b.position)
			.map(rowToPerson);
	});
}

export async function listQuestions(giftId: string): Promise<Question[]> {
	const rows = await db
		.select()
		.from(questionsTable)
		.where(eq(questionsTable.giftId, giftId))
		.orderBy(asc(questionsTable.position));
	return rows.map(rowToQuestion);
}

export async function findLibraryQuestion(
	giftId: string,
	templateId: string,
): Promise<Question | null> {
	const [row] = await db
		.select()
		.from(questionsTable)
		.where(
			and(
				eq(questionsTable.giftId, giftId),
				eq(questionsTable.source, "library"),
				eq(questionsTable.templateId, templateId),
			),
		)
		.limit(1);
	return row ? rowToQuestion(row) : null;
}

export interface AddLibraryQuestion {
	source: "library";
	templateId: string;
	text: string;
}

export interface AddCustomQuestion {
	source: "custom";
	text: string;
	preface?: string | null;
	// Lets sync re-create a custom question while preserving the URL
	// of an already-uploaded photo. The route does NOT accept a base64
	// data URL here — actual uploads go through POST .../photo.
	photoUrl?: string | null;
}

export interface AddAiQuestion {
	source: "ai";
	text: string;
	preface?: string | null;
}

export async function addQuestion(
	giftId: string,
	input: AddLibraryQuestion | AddCustomQuestion | AddAiQuestion,
): Promise<Question> {
	if (input.source === "library") {
		const existing = await findLibraryQuestion(giftId, input.templateId);
		if (existing) return existing;
	}
	const position = await nextPosition(questionsTable, giftId);
	const baseValues = {
		id: genId("q"),
		giftId,
		text: input.text,
		position,
	};
	let values: typeof questionsTable.$inferInsert;
	if (input.source === "library") {
		values = {
			...baseValues,
			source: "library" as const,
			templateId: input.templateId,
		};
	} else if (input.source === "ai") {
		values = {
			...baseValues,
			source: "ai" as const,
			preface: input.preface ?? null,
		};
	} else {
		values = {
			...baseValues,
			source: "custom" as const,
			preface: input.preface ?? null,
			photoUrl: input.photoUrl ?? null,
		};
	}
	const [row] = await db.insert(questionsTable).values(values).returning();
	return rowToQuestion(row);
}

export async function patchQuestion(
	giftId: string,
	qid: string,
	patch: Partial<Pick<Question, "text" | "preface" | "position">>,
): Promise<Question | null> {
	const update: Partial<typeof questionsTable.$inferInsert> = {};
	assignDefined(update, patch, ["text", "preface", "position"]);
	if (Object.keys(update).length === 0) {
		const [row] = await db
			.select()
			.from(questionsTable)
			.where(
				and(eq(questionsTable.giftId, giftId), eq(questionsTable.id, qid)),
			);
		return row ? rowToQuestion(row) : null;
	}
	const [row] = await db
		.update(questionsTable)
		.set(update)
		.where(and(eq(questionsTable.giftId, giftId), eq(questionsTable.id, qid)))
		.returning();
	return row ? rowToQuestion(row) : null;
}

export async function deleteQuestion(
	giftId: string,
	qid: string,
): Promise<boolean> {
	const [removed] = await db
		.delete(questionsTable)
		.where(and(eq(questionsTable.giftId, giftId), eq(questionsTable.id, qid)))
		.returning({ position: questionsTable.position });
	if (!removed) return false;
	await db
		.update(questionsTable)
		.set({ position: sql`${questionsTable.position} - 1` })
		.where(
			and(
				eq(questionsTable.giftId, giftId),
				gt(questionsTable.position, removed.position),
			),
		);
	return true;
}

export async function setQuestionPhoto(
	giftId: string,
	qid: string,
	photoUrl: string | null,
): Promise<Question | null> {
	const [row] = await db
		.update(questionsTable)
		.set({ photoUrl })
		.where(and(eq(questionsTable.giftId, giftId), eq(questionsTable.id, qid)))
		.returning();
	return row ? rowToQuestion(row) : null;
}

export class SendValidationError extends Error {
	readonly field: string;
	constructor(field: string, message: string) {
		super(message);
		this.field = field;
	}
}

export interface SendResult {
	gift: Gift;
	recipient: Recipient;
	alreadySent: boolean;
}

export async function sendGift(
	id: string,
	xorsUserId: string,
): Promise<SendResult> {
	const gift = await getGift(id, xorsUserId);
	if (!gift) throw new SendValidationError("gift", "Gift not found");

	if (gift.status === "sent" || gift.sentAt) {
		const existing = await getRecipientForGift(id);
		if (!existing)
			throw new SendValidationError("gift", "Sent gift missing recipient");
		return { gift, recipient: existing, alreadySent: true };
	}

	const questionList = await listQuestions(id);
	if (questionList.length < 3) {
		throw new SendValidationError(
			"questions",
			"Need at least 3 questions before sending",
		);
	}
	if (gift.delivery === "email" && !gift.recipientEmail) {
		throw new SendValidationError(
			"recipientEmail",
			"Recipient email is required",
		);
	}

	return db.transaction(async (tx) => {
		const [recipientRow] = await tx
			.insert(recipientsTable)
			.values({
				id: genId("rcp"),
				giftId: id,
				accessToken: genToken(),
				email: gift.recipientEmail ?? "",
				name: gift.recipientName,
			})
			.returning();
		const [updatedGiftRow] = await tx
			.update(giftsTable)
			.set({
				status: "sent",
				sentAt: new Date(),
				currentStep: "complete",
				updatedAt: new Date(),
			})
			.where(eq(giftsTable.id, id))
			.returning();
		return {
			gift: rowToGift(updatedGiftRow),
			recipient: rowToRecipient(recipientRow),
			alreadySent: false,
		};
	});
}

// Recipient routes land via token, not session, so they look up the
// gift via the recipient row instead of going through getGift().
export async function loadByToken(
	token: string,
): Promise<{ gift: Gift; recipient: Recipient } | null> {
	const [row] = await db
		.select({
			recipient: recipientsTable,
			gift: giftsTable,
		})
		.from(recipientsTable)
		.innerJoin(giftsTable, eq(recipientsTable.giftId, giftsTable.id))
		.where(eq(recipientsTable.accessToken, token));
	if (!row) return null;
	return { gift: rowToGift(row.gift), recipient: rowToRecipient(row.recipient) };
}

// Caller MUST have already authorized the gift (via getGift/loadGift).
export async function getRecipientForGift(
	giftId: string,
): Promise<Recipient | null> {
	const [row] = await db
		.select()
		.from(recipientsTable)
		.where(eq(recipientsTable.giftId, giftId));
	return row ? rowToRecipient(row) : null;
}

export async function touchRecipient(token: string): Promise<Recipient | null> {
	const [row] = await db
		.update(recipientsTable)
		.set({
			firstSeenAt: sql`coalesce(${recipientsTable.firstSeenAt}, now())`,
			lastActiveAt: sql`now()`,
		})
		.where(eq(recipientsTable.accessToken, token))
		.returning();
	return row ? rowToRecipient(row) : null;
}

export async function listResponses(giftId: string): Promise<Response[]> {
	const rows = await db
		.select()
		.from(responsesTable)
		.where(eq(responsesTable.giftId, giftId));
	return rows.map(rowToResponse);
}

export async function listResponsesForQuestion(
	giftId: string,
	questionId: string,
): Promise<Response[]> {
	const rows = await db
		.select()
		.from(responsesTable)
		.where(
			and(
				eq(responsesTable.giftId, giftId),
				eq(responsesTable.questionId, questionId),
			),
		);
	return rows.map(rowToResponse);
}

export interface SaveResponseInput {
	giftId: string;
	recipientId: string;
	questionId: string;
	kind: ResponseKind;
	text?: string | null;
	audioUrl?: string | null;
	photoUrl?: string | null;
}

export async function saveResponse(
	input: SaveResponseInput,
): Promise<Response> {
	const [existing] = await db
		.select()
		.from(responsesTable)
		.where(
			and(
				eq(responsesTable.giftId, input.giftId),
				eq(responsesTable.questionId, input.questionId),
				eq(responsesTable.kind, input.kind),
			),
		);
	if (existing) {
		const update: Partial<typeof responsesTable.$inferInsert> = {
			recordedAt: new Date(),
		};
		assignDefined(update, input, ["text", "audioUrl", "photoUrl"]);
		const [row] = await db
			.update(responsesTable)
			.set(update)
			.where(eq(responsesTable.id, existing.id))
			.returning();
		return rowToResponse(row);
	}
	const [row] = await db
		.insert(responsesTable)
		.values({
			id: genId("res"),
			giftId: input.giftId,
			recipientId: input.recipientId,
			questionId: input.questionId,
			kind: input.kind,
			text: input.text ?? null,
			audioUrl: input.audioUrl ?? null,
			photoUrl: input.photoUrl ?? null,
		})
		.returning();
	return rowToResponse(row);
}

export async function deleteResponse(
	giftId: string,
	rid: string,
): Promise<boolean> {
	const result = await db
		.delete(responsesTable)
		.where(and(eq(responsesTable.giftId, giftId), eq(responsesTable.id, rid)))
		.returning({ id: responsesTable.id });
	return result.length > 0;
}
