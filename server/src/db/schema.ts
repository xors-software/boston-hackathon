import {
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// `users` is keyed by `xors_user_id` directly — no separate local
// surrogate id. The xors id IS the user id everywhere downstream.

export const intentEnum = pgEnum("gift_intent", [
	"mom",
	"dad",
	"loved-one",
	"undecided",
]);

export const deliveryEnum = pgEnum("gift_delivery", ["email", "in-person"]);

export const statusEnum = pgEnum("gift_status", ["draft", "sent", "archived"]);

export const stepEnum = pgEnum("onboarding_step", [
	"welcome",
	"intent",
	"account",
	"recipient",
	"why",
	"world",
	"questions",
	"delivery",
	"send",
	"complete",
]);

export const questionSourceEnum = pgEnum("question_source", [
	"library",
	"custom",
	"ai",
]);

export const responseKindEnum = pgEnum("response_kind", [
	"text",
	"voice",
	"photo",
]);

export const entrySourceEnum = pgEnum("entry_source", [
	"free-write",
	"prompt",
	"ai",
	"voice",
	"photo",
]);

export const sharingModeEnum = pgEnum("sharing_mode", [
	"when-ready",
	"legacy",
	"date",
	"milestone",
]);

export const milestonePresetEnum = pgEnum("milestone_preset", [
	"future-birthday",
	"anniversary",
	"in-one-year",
	"custom",
]);

export const users = pgTable(
	"users",
	{
		xorsUserId: text("xors_user_id").primaryKey(),
		email: text("email").notNull().default(""),
		displayName: text("display_name"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("users_email_idx").on(t.email)],
);

export const messages = pgTable(
	"messages",
	{
		id: text("id").primaryKey(),
		fromXorsUserId: text("from_xors_user_id")
			.notNull()
			.references(() => users.xorsUserId, { onDelete: "cascade" }),
		toXorsUserId: text("to_xors_user_id")
			.notNull()
			.references(() => users.xorsUserId, { onDelete: "cascade" }),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("messages_from_idx").on(t.fromXorsUserId, t.createdAt),
		index("messages_to_idx").on(t.toXorsUserId, t.createdAt),
	],
);

export const gifts = pgTable(
	"gifts",
	{
		id: text("id").primaryKey(),
		xorsUserId: text("xors_user_id")
			.notNull()
			.references(() => users.xorsUserId, { onDelete: "cascade" }),
		intent: intentEnum("intent").notNull().default("undecided"),
		about: text("about").notNull().default(""),
		why: text("why").notNull().default(""),
		delivery: deliveryEnum("delivery").notNull().default("email"),
		recipientName: text("recipient_name").notNull().default("Them"),
		recipientEmail: text("recipient_email"),
		personalMessage: text("personal_message"),
		currentStep: stepEnum("current_step").notNull().default("intent"),
		status: statusEnum("status").notNull().default("draft"),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		timeLockAt: timestamp("time_lock_at", { withTimezone: true }),
		releasedAt: timestamp("released_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("gifts_xors_user_id_idx").on(t.xorsUserId)],
);

export const people = pgTable(
	"people",
	{
		id: text("id").primaryKey(),
		giftId: text("gift_id")
			.notNull()
			.references(() => gifts.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		relationship: text("relationship").notNull(),
		age: text("age").notNull().default(""),
		description: text("description").notNull().default(""),
		position: integer("position").notNull().default(0),
	},
	(t) => [index("people_gift_id_idx").on(t.giftId)],
);

export const questions = pgTable(
	"questions",
	{
		id: text("id").primaryKey(),
		giftId: text("gift_id")
			.notNull()
			.references(() => gifts.id, { onDelete: "cascade" }),
		source: questionSourceEnum("source").notNull(),
		templateId: text("template_id"),
		text: text("text").notNull(),
		photoUrl: text("photo_url"),
		preface: text("preface"),
		position: integer("position").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("questions_gift_id_idx").on(t.giftId)],
);

export const recipients = pgTable(
	"recipients",
	{
		id: text("id").primaryKey(),
		giftId: text("gift_id")
			.notNull()
			.references(() => gifts.id, { onDelete: "cascade" }),
		accessToken: text("access_token").notNull(),
		email: text("email").notNull().default(""),
		name: text("name").notNull().default(""),
		passwordHash: text("password_hash"),
		accountCreatedAt: timestamp("account_created_at", { withTimezone: true }),
		firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
		lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
	},
	(t) => [
		uniqueIndex("recipients_gift_id_uniq").on(t.giftId),
		uniqueIndex("recipients_access_token_uniq").on(t.accessToken),
		index("recipients_email_idx").on(t.email),
	],
);

export const responses = pgTable(
	"responses",
	{
		id: text("id").primaryKey(),
		giftId: text("gift_id")
			.notNull()
			.references(() => gifts.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => recipients.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		kind: responseKindEnum("kind").notNull(),
		text: text("text"),
		audioUrl: text("audio_url"),
		photoUrl: text("photo_url"),
		recordedAt: timestamp("recorded_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("responses_gift_id_idx").on(t.giftId),
		index("responses_question_id_idx").on(t.questionId),
	],
);

export const journalEntries = pgTable(
	"journal_entries",
	{
		id: text("id").primaryKey(),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => recipients.id, { onDelete: "cascade" }),
		giftId: text("gift_id")
			.notNull()
			.references(() => gifts.id, { onDelete: "cascade" }),
		source: entrySourceEnum("source").notNull(),
		text: text("text"),
		promptId: text("prompt_id"),
		promptText: text("prompt_text"),
		photoUrl: text("photo_url"),
		audioUrl: text("audio_url"),
		durationSeconds: integer("duration_seconds"),
		preface: text("preface"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("journal_entries_recipient_idx").on(t.recipientId, t.createdAt),
		index("journal_entries_gift_idx").on(t.giftId),
	],
);

export const sharing = pgTable("sharing", {
	recipientId: text("recipient_id")
		.primaryKey()
		.references(() => recipients.id, { onDelete: "cascade" }),
	mode: sharingModeEnum("mode").notNull().default("when-ready"),
	date: date("date"),
	milestonePreset: milestonePresetEnum("milestone_preset"),
	milestoneText: text("milestone_text"),
	sharedAt: timestamp("shared_at", { withTimezone: true }),
	lastSharedSnapshotCount: integer("last_shared_snapshot_count"),
});
