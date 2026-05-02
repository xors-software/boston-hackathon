// Direct messaging between authenticated users. Every route requires a
// valid xors_session cookie — handlers 401 on missing currentUser.
//
// Storage is an in-memory array for the starter. Replace with a real DB
// when persistence matters; the route shapes are designed to translate
// directly to a SQL `messages` table keyed by (from_user_id, to_user_id).

import { Elysia, t } from "elysia";
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

const messages: Message[] = [];

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
		({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const mine = messages.filter(
				(m) => m.fromUserId === currentUser.id || m.toUserId === currentUser.id,
			);
			return { messages: mine };
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
		({ currentUser, params: { userId }, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const other = findUserById(userId);
			if (!other) {
				set.status = 404;
				return { error: "User not found" };
			}
			const thread = messages.filter(
				(m) =>
					(m.fromUserId === currentUser.id && m.toUserId === other.id) ||
					(m.fromUserId === other.id && m.toUserId === currentUser.id),
			);
			return {
				with: {
					id: other.id,
					email: other.email,
					displayName: other.displayName,
				},
				messages: thread,
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
		({ currentUser, body, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const recipient = findUserById(body.toUserId);
			if (!recipient) {
				set.status = 404;
				return { error: "Recipient not found" };
			}
			if (recipient.id === currentUser.id) {
				set.status = 400;
				return { error: "Cannot send a message to yourself" };
			}
			const message: Message = {
				id: generateMessageId(),
				fromUserId: currentUser.id,
				toUserId: recipient.id,
				content: body.content,
				createdAt: new Date().toISOString(),
			};
			messages.push(message);
			return { message };
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
		({ currentUser, set }) => {
			if (!currentUser) {
				set.status = 401;
				return { error: "Not authenticated" };
			}
			const others = listAllUsers()
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
