import { sql } from "../db";

export type GiftRow = {
	id: string;
	user_id: string;
	intent: string;
	about: string | null;
	why: string | null;
	recipient_name: string | null;
	recipient_email: string | null;
	delivery: string | null;
	current_step: string | null;
	status: string;
	sent_at: Date | null;
	time_lock_at: Date | null;
	created_at: Date;
	updated_at: Date;
};

export type Gift = {
	id: string;
	userId: string;
	intent: string;
	about: string | null;
	why: string | null;
	recipientName: string | null;
	recipientEmail: string | null;
	delivery: string | null;
	currentStep: string | null;
	status: "draft" | "sent";
	sentAt: string | null;
	timeLockAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type Person = {
	id: string;
	giftId: string;
	name: string;
	relationship: string | null;
	age: string | null;
	description: string | null;
	position: number;
	createdAt: string;
};

export type Question = {
	id: string;
	giftId: string;
	source: "library" | "custom";
	templateId: string | null;
	text: string;
	preface: string | null;
	photoUrl: string | null;
	position: number;
	createdAt: string;
};

export type Recipient = {
	id: string;
	giftId: string;
	name: string | null;
	email: string | null;
	accessToken: string;
	createdAt: string;
};

export type Response = {
	id: string;
	questionId: string;
	recipientId: string;
	kind: "text" | "audio" | "photo";
	text: string | null;
	audioUrl: string | null;
	photoUrl: string | null;
	caption: string | null;
	transcript: string | null;
	createdAt: string;
};

function newId(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newToken(): string {
	// 24 url-safe bytes ≈ 192 bits; collisions effectively zero.
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return Buffer.from(bytes)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function rowToGift(r: GiftRow): Gift {
	return {
		id: r.id,
		userId: r.user_id,
		intent: r.intent,
		about: r.about,
		why: r.why,
		recipientName: r.recipient_name,
		recipientEmail: r.recipient_email,
		delivery: r.delivery,
		currentStep: r.current_step,
		status: r.status as "draft" | "sent",
		sentAt: r.sent_at?.toISOString() ?? null,
		timeLockAt: r.time_lock_at?.toISOString() ?? null,
		createdAt: r.created_at.toISOString(),
		updatedAt: r.updated_at.toISOString(),
	};
}

export async function createGift(
	userId: string,
	intent: string,
): Promise<Gift> {
	const id = newId("gft");
	const [row] = await sql<GiftRow[]>`
		INSERT INTO gifts (id, user_id, intent)
		VALUES (${id}, ${userId}, ${intent})
		RETURNING *
	`;
	return rowToGift(row);
}

// Returns null when the gift doesn't exist OR belongs to another user. The
// e2e test relies on this collapse — we don't leak existence cross-user.
export async function getGift(
	id: string,
	userId: string,
): Promise<Gift | null> {
	const [row] = await sql<GiftRow[]>`
		SELECT * FROM gifts WHERE id = ${id} AND user_id = ${userId}
	`;
	return row ? rowToGift(row) : null;
}

// Used by recipient routes that have a token but no userId. Skips the
// ownership check by design — caller must verify access via the token.
export async function getGiftById(id: string): Promise<Gift | null> {
	const [row] = await sql<GiftRow[]>`SELECT * FROM gifts WHERE id = ${id}`;
	return row ? rowToGift(row) : null;
}

export async function listGifts(userId: string): Promise<Gift[]> {
	const rows = await sql<GiftRow[]>`
		SELECT * FROM gifts WHERE user_id = ${userId} ORDER BY created_at DESC
	`;
	return rows.map(rowToGift);
}

export type GiftPatch = {
	about?: string;
	why?: string;
	recipientName?: string;
	recipientEmail?: string;
	delivery?: string;
	currentStep?: string;
	timeLockAt?: string | null;
};

export async function patchGift(
	id: string,
	userId: string,
	patch: GiftPatch,
): Promise<Gift | null> {
	const owner = await getGift(id, userId);
	if (!owner) return null;
	const [row] = await sql<GiftRow[]>`
		UPDATE gifts SET
			about = COALESCE(${patch.about ?? null}, about),
			why = COALESCE(${patch.why ?? null}, why),
			recipient_name = COALESCE(${patch.recipientName ?? null}, recipient_name),
			recipient_email = COALESCE(${patch.recipientEmail ?? null}, recipient_email),
			delivery = COALESCE(${patch.delivery ?? null}, delivery),
			current_step = COALESCE(${patch.currentStep ?? null}, current_step),
			time_lock_at = ${patch.timeLockAt ? new Date(patch.timeLockAt) : null},
			updated_at = now()
		WHERE id = ${id} AND user_id = ${userId}
		RETURNING *
	`;
	return row ? rowToGift(row) : null;
}

export async function listPeople(giftId: string): Promise<Person[]> {
	const rows = await sql`
		SELECT * FROM people WHERE gift_id = ${giftId} ORDER BY position ASC, created_at ASC
	`;
	return rows.map((r: Record<string, unknown>) => ({
		id: r.id as string,
		giftId: r.gift_id as string,
		name: r.name as string,
		relationship: (r.relationship as string | null) ?? null,
		age: (r.age as string | null) ?? null,
		description: (r.description as string | null) ?? null,
		position: r.position as number,
		createdAt: (r.created_at as Date).toISOString(),
	}));
}

export type PersonInput = {
	name: string;
	relationship?: string;
	age?: string;
	description?: string;
};

// PUT semantics: replaces the entire people list for the gift in a single
// transaction. Caller has already verified ownership of the gift.
export async function replacePeople(
	giftId: string,
	people: PersonInput[],
): Promise<Person[]> {
	await sql.begin(async (tx) => {
		await tx`DELETE FROM people WHERE gift_id = ${giftId}`;
		for (let i = 0; i < people.length; i++) {
			const p = people[i];
			await tx`
				INSERT INTO people (id, gift_id, name, relationship, age, description, position)
				VALUES (
					${newId("prs")}, ${giftId}, ${p.name},
					${p.relationship ?? null}, ${p.age ?? null}, ${p.description ?? null},
					${i}
				)
			`;
		}
	});
	return listPeople(giftId);
}

export async function listQuestions(giftId: string): Promise<Question[]> {
	const rows = await sql`
		SELECT * FROM questions WHERE gift_id = ${giftId} ORDER BY position ASC, created_at ASC
	`;
	return rows.map((r: Record<string, unknown>) => ({
		id: r.id as string,
		giftId: r.gift_id as string,
		source: r.source as "library" | "custom",
		templateId: (r.template_id as string | null) ?? null,
		text: r.text as string,
		preface: (r.preface as string | null) ?? null,
		photoUrl: (r.photo_url as string | null) ?? null,
		position: r.position as number,
		createdAt: (r.created_at as Date).toISOString(),
	}));
}

export async function getQuestion(
	id: string,
	giftId: string,
): Promise<Question | null> {
	const rows = await sql`
		SELECT * FROM questions WHERE id = ${id} AND gift_id = ${giftId}
	`;
	const r = rows[0];
	if (!r) return null;
	return {
		id: r.id as string,
		giftId: r.gift_id as string,
		source: r.source as "library" | "custom",
		templateId: (r.template_id as string | null) ?? null,
		text: r.text as string,
		preface: (r.preface as string | null) ?? null,
		photoUrl: (r.photo_url as string | null) ?? null,
		position: r.position as number,
		createdAt: (r.created_at as Date).toISOString(),
	};
}

export async function getQuestionByIdOnly(
	id: string,
): Promise<Question | null> {
	const rows = await sql`SELECT * FROM questions WHERE id = ${id}`;
	const r = rows[0];
	if (!r) return null;
	return {
		id: r.id as string,
		giftId: r.gift_id as string,
		source: r.source as "library" | "custom",
		templateId: (r.template_id as string | null) ?? null,
		text: r.text as string,
		preface: (r.preface as string | null) ?? null,
		photoUrl: (r.photo_url as string | null) ?? null,
		position: r.position as number,
		createdAt: (r.created_at as Date).toISOString(),
	};
}

export type QuestionInput =
	| { source: "library"; templateId: string; text: string }
	| { source: "custom"; text: string; preface?: string };

export async function createQuestion(
	giftId: string,
	input: QuestionInput,
): Promise<Question> {
	const id = newId("qst");
	const [{ next_position: nextPosition }] = await sql<{ next_position: number }[]>`
		SELECT COALESCE(MAX(position), -1) + 1 AS next_position
		FROM questions WHERE gift_id = ${giftId}
	`;
	if (input.source === "library") {
		await sql`
			INSERT INTO questions (id, gift_id, source, template_id, text, position)
			VALUES (${id}, ${giftId}, 'library', ${input.templateId}, ${input.text}, ${nextPosition})
		`;
	} else {
		await sql`
			INSERT INTO questions (id, gift_id, source, text, preface, position)
			VALUES (${id}, ${giftId}, 'custom', ${input.text}, ${input.preface ?? null}, ${nextPosition})
		`;
	}
	const q = await getQuestion(id, giftId);
	if (!q) throw new Error("Question vanished after insert");
	return q;
}

export type QuestionPatch = {
	text?: string;
	preface?: string;
	position?: number;
};

export async function patchQuestion(
	id: string,
	giftId: string,
	patch: QuestionPatch,
): Promise<Question | null> {
	const existing = await getQuestion(id, giftId);
	if (!existing) return null;
	await sql`
		UPDATE questions SET
			text = COALESCE(${patch.text ?? null}, text),
			preface = COALESCE(${patch.preface ?? null}, preface),
			position = COALESCE(${patch.position ?? null}, position)
		WHERE id = ${id} AND gift_id = ${giftId}
	`;
	return getQuestion(id, giftId);
}

export async function setQuestionPhotoUrl(
	id: string,
	giftId: string,
	photoUrl: string,
): Promise<Question | null> {
	const existing = await getQuestion(id, giftId);
	if (!existing) return null;
	await sql`UPDATE questions SET photo_url = ${photoUrl} WHERE id = ${id}`;
	return getQuestion(id, giftId);
}

export async function getRecipientByGift(
	giftId: string,
): Promise<Recipient | null> {
	const rows = await sql`SELECT * FROM recipients WHERE gift_id = ${giftId}`;
	const r = rows[0];
	if (!r) return null;
	return {
		id: r.id as string,
		giftId: r.gift_id as string,
		name: (r.name as string | null) ?? null,
		email: (r.email as string | null) ?? null,
		accessToken: r.access_token as string,
		createdAt: (r.created_at as Date).toISOString(),
	};
}

export async function getRecipientByToken(
	token: string,
): Promise<Recipient | null> {
	const rows = await sql`SELECT * FROM recipients WHERE access_token = ${token}`;
	const r = rows[0];
	if (!r) return null;
	return {
		id: r.id as string,
		giftId: r.gift_id as string,
		name: (r.name as string | null) ?? null,
		email: (r.email as string | null) ?? null,
		accessToken: r.access_token as string,
		createdAt: (r.created_at as Date).toISOString(),
	};
}

export type SendResult = {
	gift: Gift;
	recipient: Recipient;
	alreadySent: boolean;
};

// Idempotent — re-sending an already-sent gift returns the same recipient
// row + token. The frontend can hit /send to retrieve the share link.
export async function sendGift(
	id: string,
	userId: string,
): Promise<SendResult | { error: "not_found" } | { error: "missing_recipient" }> {
	const gift = await getGift(id, userId);
	if (!gift) return { error: "not_found" };
	if (!gift.recipientEmail || !gift.recipientName) {
		return { error: "missing_recipient" };
	}

	const existing = await getRecipientByGift(id);
	if (existing && gift.status === "sent") {
		return { gift, recipient: existing, alreadySent: true };
	}

	const recipient =
		existing ??
		(await (async () => {
			const [row] = await sql`
				INSERT INTO recipients (id, gift_id, name, email, access_token)
				VALUES (${newId("rcp")}, ${id}, ${gift.recipientName}, ${gift.recipientEmail}, ${newToken()})
				RETURNING *
			`;
			return {
				id: row.id as string,
				giftId: row.gift_id as string,
				name: (row.name as string | null) ?? null,
				email: (row.email as string | null) ?? null,
				accessToken: row.access_token as string,
				createdAt: (row.created_at as Date).toISOString(),
			};
		})());

	const [updated] = await sql<GiftRow[]>`
		UPDATE gifts SET status = 'sent', sent_at = now(), updated_at = now()
		WHERE id = ${id} AND user_id = ${userId}
		RETURNING *
	`;

	return {
		gift: rowToGift(updated),
		recipient,
		alreadySent: false,
	};
}

export async function listResponses(questionId: string): Promise<Response[]> {
	const rows = await sql`
		SELECT * FROM responses WHERE question_id = ${questionId} ORDER BY created_at ASC
	`;
	return rows.map((r: Record<string, unknown>) => rowToResponse(r));
}

function rowToResponse(r: Record<string, unknown>): Response {
	return {
		id: r.id as string,
		questionId: r.question_id as string,
		recipientId: r.recipient_id as string,
		kind: r.kind as "text" | "audio" | "photo",
		text: (r.text as string | null) ?? null,
		audioUrl: (r.audio_url as string | null) ?? null,
		photoUrl: (r.photo_url as string | null) ?? null,
		caption: (r.caption as string | null) ?? null,
		transcript: (r.transcript as string | null) ?? null,
		createdAt: (r.created_at as Date).toISOString(),
	};
}

export async function createTextResponse(
	questionId: string,
	recipientId: string,
	text: string,
): Promise<Response> {
	const id = newId("rsp");
	const [row] = await sql`
		INSERT INTO responses (id, question_id, recipient_id, kind, text)
		VALUES (${id}, ${questionId}, ${recipientId}, 'text', ${text})
		RETURNING *
	`;
	return rowToResponse(row);
}

export async function createAudioResponse(
	questionId: string,
	recipientId: string,
	audioUrl: string,
	transcript: string | null,
): Promise<Response> {
	const id = newId("rsp");
	const [row] = await sql`
		INSERT INTO responses (id, question_id, recipient_id, kind, audio_url, transcript)
		VALUES (${id}, ${questionId}, ${recipientId}, 'audio', ${audioUrl}, ${transcript})
		RETURNING *
	`;
	return rowToResponse(row);
}

export async function createPhotoResponse(
	questionId: string,
	recipientId: string,
	photoUrl: string,
	caption: string | null,
): Promise<Response> {
	const id = newId("rsp");
	const [row] = await sql`
		INSERT INTO responses (id, question_id, recipient_id, kind, photo_url, caption)
		VALUES (${id}, ${questionId}, ${recipientId}, 'photo', ${photoUrl}, ${caption})
		RETURNING *
	`;
	return rowToResponse(row);
}

export async function listResponsesForGift(giftId: string): Promise<Response[]> {
	const rows = await sql`
		SELECT r.* FROM responses r
		JOIN questions q ON r.question_id = q.id
		WHERE q.gift_id = ${giftId}
		ORDER BY r.created_at ASC
	`;
	return rows.map((r: Record<string, unknown>) => rowToResponse(r));
}
