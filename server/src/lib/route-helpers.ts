import { t } from "elysia";
import { getGift, type Gift } from "./gift-store";
import type { AppUser } from "./xors-identity";

export const errorSchema = t.Object({ error: t.String() });

export const questionSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	source: t.Union([t.Literal("library"), t.Literal("custom"), t.Literal("ai")]),
	templateId: t.Union([t.String(), t.Null()]),
	text: t.String(),
	photoUrl: t.Union([t.String(), t.Null()]),
	preface: t.Union([t.String(), t.Null()]),
	position: t.Number(),
	createdAt: t.String(),
});

export const responseSchema = t.Object({
	id: t.String(),
	giftId: t.String(),
	recipientId: t.String(),
	questionId: t.String(),
	kind: t.Union([t.Literal("text"), t.Literal("voice"), t.Literal("photo")]),
	text: t.Union([t.String(), t.Null()]),
	audioUrl: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
	recordedAt: t.String(),
});

export const entrySourceSchema = t.Union([
	t.Literal("free-write"),
	t.Literal("prompt"),
	t.Literal("ai"),
	t.Literal("voice"),
	t.Literal("photo"),
]);

export const journalEntrySchema = t.Object({
	id: t.String(),
	recipientId: t.String(),
	giftId: t.String(),
	source: entrySourceSchema,
	text: t.Union([t.String(), t.Null()]),
	promptId: t.Union([t.String(), t.Null()]),
	promptText: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
	audioUrl: t.Union([t.String(), t.Null()]),
	durationSeconds: t.Union([t.Number(), t.Null()]),
	preface: t.Union([t.String(), t.Null()]),
	createdAt: t.String(),
});

export const sharingModeSchema = t.Union([
	t.Literal("when-ready"),
	t.Literal("legacy"),
	t.Literal("date"),
	t.Literal("milestone"),
]);

export const milestonePresetSchema = t.Union([
	t.Literal("future-birthday"),
	t.Literal("anniversary"),
	t.Literal("in-one-year"),
	t.Literal("custom"),
]);

export const sharingStateSchema = t.Object({
	recipientId: t.String(),
	mode: sharingModeSchema,
	date: t.Union([t.String(), t.Null()]),
	milestonePreset: t.Union([milestonePresetSchema, t.Null()]),
	milestoneText: t.Union([t.String(), t.Null()]),
	sharedAt: t.Union([t.String(), t.Null()]),
	lastSharedSnapshotCount: t.Union([t.Number(), t.Null()]),
});

export const parentPromptSchema = t.Object({
	id: t.String(),
	text: t.String(),
	preface: t.Union([t.String(), t.Null()]),
	photoUrl: t.Union([t.String(), t.Null()]),
});

interface RouteCtx {
	currentUser: AppUser | null;
	set: { status?: number | string };
}

interface GiftCtx extends RouteCtx {
	params: { id: string };
}

export interface AuthFail {
	__fail: true;
	error: string;
}

function fail(set: RouteCtx["set"], status: number, error: string): AuthFail {
	set.status = status;
	return { __fail: true, error };
}

export function isFail(v: unknown): v is AuthFail {
	return typeof v === "object" && v !== null && (v as AuthFail).__fail === true;
}

export function requireUser(ctx: RouteCtx): AppUser | AuthFail {
	if (!ctx.currentUser) return fail(ctx.set, 401, "Not authenticated");
	return ctx.currentUser;
}

export async function loadGift(
	ctx: GiftCtx,
): Promise<{ user: AppUser; gift: Gift } | AuthFail> {
	const user = requireUser(ctx);
	if (isFail(user)) return user;
	const gift = await getGift(ctx.params.id, user.id);
	if (!gift) return fail(ctx.set, 404, "Gift not found");
	return { user, gift };
}
