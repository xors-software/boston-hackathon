import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db/client";
import { users } from "../db/schema";
import { readCookie } from "./cookies";

const XORS_API_URL =
	process.env.XORS_API_URL ||
	process.env.NEXT_PUBLIC_XORS_API_URL ||
	"https://api.xors.xyz";

export const XORS_SESSION_COOKIE = "xors_session";

export interface AppUser {
	id: string;
	email: string;
	displayName: string | null;
	createdAt: string;
	xorsUserId: string;
}

interface XorsViewer {
	id: string;
	email?: string;
	username?: string | null;
	level?: string | number | null;
}

async function fetchXorsViewer(sessionKey: string): Promise<XorsViewer | null> {
	if (!sessionKey) return null;
	try {
		const res = await fetch(`${XORS_API_URL}/api/users/viewer`, {
			method: "GET",
			headers: { "X-API-KEY": sessionKey, "Content-Type": "application/json" },
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { viewer?: XorsViewer };
		const v = body.viewer;
		if (!v || typeof v.id !== "string") return null;
		return v;
	} catch (err) {
		console.error(
			"[xors] viewer fetch failed:",
			err instanceof Error ? err.message : err,
		);
		return null;
	}
}

function rowToAppUser(row: typeof users.$inferSelect): AppUser {
	return {
		// `id` is kept as a field for callsites (`currentUser.id`) but is
		// the same value as `xorsUserId` — the existing DB schema keys
		// users by xors_user_id directly, no separate local surrogate.
		id: row.xorsUserId,
		xorsUserId: row.xorsUserId,
		email: row.email,
		displayName: row.displayName,
		createdAt: row.createdAt.toISOString(),
	};
}

async function upsertFromViewer(viewer: XorsViewer): Promise<AppUser> {
	const email = (viewer.email ?? "").toLowerCase();
	const displayName = viewer.username ?? null;

	const [existing] = await db
		.select()
		.from(users)
		.where(eq(users.xorsUserId, viewer.id));
	if (existing) {
		const needsUpdate =
			(email && existing.email !== email) ||
			existing.displayName !== displayName;
		if (!needsUpdate) return rowToAppUser(existing);
		const [updated] = await db
			.update(users)
			.set({ email: email || existing.email, displayName })
			.where(eq(users.xorsUserId, viewer.id))
			.returning();
		return rowToAppUser(updated);
	}

	const [inserted] = await db
		.insert(users)
		.values({
			xorsUserId: viewer.id,
			email,
			displayName,
		})
		.returning();
	return rowToAppUser(inserted);
}

// Local-dev bypass — when TEST_USER_EMAIL is set, requests resolve to
// a deterministic fake user so e2e tests don't round-trip through
// Google + api.xors.xyz. Never set this in deployed envs.
async function maybeTestUser(): Promise<AppUser | null> {
	const email = process.env.TEST_USER_EMAIL;
	if (!email) return null;
	return upsertFromViewer({
		id: `test-${email}`,
		email,
		username: process.env.TEST_USER_NAME ?? null,
	});
}

async function resolveCurrentUser(headers: Headers): Promise<AppUser | null> {
	const testUser = await maybeTestUser();
	if (testUser) return testUser;
	const sessionKey = readCookie(headers, XORS_SESSION_COOKIE);
	if (!sessionKey) return null;
	const viewer = await fetchXorsViewer(sessionKey);
	if (!viewer) return null;
	return upsertFromViewer(viewer);
}

export const authContext = new Elysia({ name: "auth-context" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const currentUser = await resolveCurrentUser(request.headers);
		return { currentUser };
	},
);

export async function findUserById(id: string): Promise<AppUser | null> {
	const [row] = await db.select().from(users).where(eq(users.xorsUserId, id));
	return row ? rowToAppUser(row) : null;
}
