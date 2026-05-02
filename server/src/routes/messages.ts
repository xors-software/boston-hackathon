import { Elysia, t } from "elysia";
import { getSql } from "../lib/pg";
import {
	authContext,
	findUserById,
	listAllUsers,
} from "../lib/xors-identity";

export interface Message {
	id: string;
	fromUserId: string;
	toUserId: string;
	content: string;
	createdAt: string;
}

interface MessageRow {
	id: string;
	from_xors_user_id: string;
	to_xors_user_id: string;
	content: string;
	created_at: Date | string;
}

function rowToMessage(r: MessageRow): Message {
	return {
		id: r.id,
		fromUserId: r.from_xors_user_id,
		toUserId: r.to_xors_user_id,
		content: r.content,
		createdAt:
			r.created_at instanceof Date
				? r.created_at.toISOString()
				: r.created_at,
	};
}

function generateMessageId(): string {
	return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const messageSchema = t.Object({
	id: t.String(),
	fromUserId: t.String(),
	toUserId: t.String(),
	content: t.String(),
	createdAt: t.String(),
});

const userSchema = t.Object({
	id: t.String(),
	email: t.String(),
	displayName: t.Union([t.String(), t.Null()]),
});

const errorSchema = t.Object({ error: t.String() });

export const messagesRoutes = new Elysia({ prefix: "/messages" })
	.use(authContext)
	.get(
		"/",
		async ({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const sql = getSql();
			const rows = await sql<MessageRow[]>`
				SELECT id, from_xors_user_id, to_xors_user_id, content, created_at
				FROM messages
				WHERE from_xors_user_id = ${currentUser.id}
				   OR to_xors_user_id   = ${currentUser.id}
				ORDER BY created_at ASC
			`;
			return { messages: rows.map(rowToMessage) };
		},
		{
			response: {
				200: t.Object({ messages: t.Array(messageSchema) }),
				401: errorSchema,
			},
			detail: { summary: "List my messages", tags: ["Messages"] },
		},
	)
	.get(
		"/with/:userId",
		async ({ currentUser, params: { userId }, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const other = await findUserById(userId);
			if (!other) {
				set.status = 404;
				return { error: "User not found" };
			}
			const sql = getSql();
			const rows = await sql<MessageRow[]>`
				SELECT id, from_xors_user_id, to_xors_user_id, content, created_at
				FROM messages
				WHERE (from_xors_user_id = ${currentUser.id} AND to_xors_user_id = ${other.id})
				   OR (from_xors_user_id = ${other.id}        AND to_xors_user_id = ${currentUser.id})
				ORDER BY created_at ASC
			`;
			return {
				with: {
					id: other.id,
					email: other.email,
					displayName: other.displayName,
				},
				messages: rows.map(rowToMessage),
			};
		},
		{
			params: t.Object({ userId: t.String({ minLength: 1 }) }),
			response: {
				200: t.Object({
					with: userSchema,
					messages: t.Array(messageSchema),
				}),
				401: errorSchema,
				404: errorSchema,
			},
			detail: {
				summary: "Get conversation with another user",
				tags: ["Messages"],
			},
		},
	)
	.post(
		"/",
		async ({ currentUser, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const recipient = await findUserById(body.toUserId);
			if (!recipient) {
				set.status = 404;
				return { error: "Recipient not found" };
			}
			if (recipient.id === currentUser.id) {
				set.status = 400;
				return { error: "Cannot send a message to yourself" };
			}
			const sql = getSql();
			const id = generateMessageId();
			const rows = await sql<MessageRow[]>`
				INSERT INTO messages (id, from_xors_user_id, to_xors_user_id, content)
				VALUES (${id}, ${currentUser.id}, ${recipient.id}, ${body.content})
				RETURNING id, from_xors_user_id, to_xors_user_id, content, created_at
			`;
			return { message: rowToMessage(rows[0]) };
		},
		{
			body: t.Object({
				toUserId: t.String({ minLength: 1 }),
				content: t.String({ minLength: 1, maxLength: 4000 }),
			}),
			response: {
				200: t.Object({ message: messageSchema }),
				400: errorSchema,
				401: errorSchema,
				404: errorSchema,
			},
			detail: { summary: "Send a message", tags: ["Messages"] },
		},
	)
	.get(
		"/recipients",
		async ({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const others = (await listAllUsers())
				.filter((u) => u.id !== currentUser.id)
				.map((u) => ({
					id: u.id,
					email: u.email,
					displayName: u.displayName,
				}));
			return { users: others };
		},
		{
			response: {
				200: t.Object({ users: t.Array(userSchema) }),
				401: errorSchema,
			},
			detail: {
				summary: "List users I can message",
				tags: ["Messages"],
			},
		},
	);
