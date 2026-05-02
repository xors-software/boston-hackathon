import { and, asc, eq, ne, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { messages, users as usersTable } from "../db/schema";
import { genId } from "../lib/ids";
import { errorSchema } from "../lib/route-helpers";
import { authContext, findUserById } from "../lib/xors-identity";

export interface Message {
	id: string;
	fromUserId: string;
	toUserId: string;
	content: string;
	createdAt: string;
}

function rowToMessage(row: typeof messages.$inferSelect): Message {
	return {
		id: row.id,
		fromUserId: row.fromXorsUserId,
		toUserId: row.toXorsUserId,
		content: row.content,
		createdAt: row.createdAt.toISOString(),
	};
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

export const messagesRoutes = new Elysia({ prefix: "/messages" })
	.use(authContext)
	.get(
		"/",
		async ({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const rows = await db
				.select()
				.from(messages)
				.where(
					or(
						eq(messages.fromXorsUserId, currentUser.id),
						eq(messages.toXorsUserId, currentUser.id),
					),
				)
				.orderBy(asc(messages.createdAt));
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
			const rows = await db
				.select()
				.from(messages)
				.where(
					or(
						and(
							eq(messages.fromXorsUserId, currentUser.id),
							eq(messages.toXorsUserId, other.id),
						),
						and(
							eq(messages.fromXorsUserId, other.id),
							eq(messages.toXorsUserId, currentUser.id),
						),
					),
				)
				.orderBy(asc(messages.createdAt));
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
			const [row] = await db
				.insert(messages)
				.values({
					id: genId("msg"),
					fromXorsUserId: currentUser.id,
					toXorsUserId: recipient.id,
					content: body.content,
				})
				.returning();
			return { message: rowToMessage(row) };
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
			const rows = await db
				.select()
				.from(usersTable)
				.where(ne(usersTable.xorsUserId, currentUser.id));
			return {
				users: rows.map((u) => ({
					id: u.xorsUserId,
					email: u.email,
					displayName: u.displayName,
				})),
			};
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
