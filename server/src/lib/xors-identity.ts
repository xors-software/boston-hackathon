// Bridge between the centralized XORS identity service (api.xors.xyz)
// and this app's user model. Mirrors the pattern used in www-magister
// and the other consumer apps (slopless, contractor-tracker, seeker)
// — a single source of truth for "who is the current user" that every
// authenticated route shares.
//
// On every authenticated request:
//   1. Read the `xors_session` cookie set by web/app/oauth/route.ts.
//   2. Hit api.xors.xyz/api/users/viewer with that as `X-API-KEY` to
//      resolve the current user.
//   3. Return a normalized AppUser shape, after lazily upserting into
//      the in-memory user store keyed by xors_user_id.
//
// The in-memory store gives us a stable internal id (so future features
// — messaging, etc. — can hold FK-style references) without coupling
// to Postgres in this starter. Swap the Map for a real DB when needed.

import { Elysia } from "elysia";
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

const usersByXorsId = new Map<string, AppUser>();
const usersByEmail = new Map<string, AppUser>();

function generateLocalUserId(): string {
	return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function upsertFromViewer(viewer: XorsViewer): AppUser {
	const email = (viewer.email ?? "").toLowerCase();
	const displayName = viewer.username ?? null;

	const existing = usersByXorsId.get(viewer.id);
	if (existing) {
		// Lazily refresh email/display_name if they drifted at xors.
		if (email && existing.email !== email) {
			usersByEmail.delete(existing.email);
			existing.email = email;
			usersByEmail.set(email, existing);
		}
		if (existing.displayName !== displayName) {
			existing.displayName = displayName;
		}
		return existing;
	}

	const fresh: AppUser = {
		id: generateLocalUserId(),
		email,
		displayName,
		createdAt: new Date().toISOString(),
		xorsUserId: viewer.id,
	};
	usersByXorsId.set(viewer.id, fresh);
	if (email) usersByEmail.set(email, fresh);
	return fresh;
}

/**
 * Resolve the current user from the xors_session cookie, or null if the
 * caller isn't authenticated.
 */
async function resolveCurrentUser(headers: Headers): Promise<AppUser | null> {
	const sessionKey = readCookie(headers, XORS_SESSION_COOKIE);
	if (!sessionKey) return null;
	const viewer = await fetchXorsViewer(sessionKey);
	if (!viewer) return null;
	return upsertFromViewer(viewer);
}

/**
 * Elysia plugin that injects `currentUser` (possibly null) onto the
 * route context. Routes that require auth check `if (!currentUser)`
 * and 401 — keeps the auth dependency out of every handler signature
 * while staying explicit at the call site.
 *
 * Usage:
 *   .use(authContext)
 *   .get("/me", ({ currentUser, set }) => {
 *     if (!currentUser) { set.status = 401; return { error: "..." }; }
 *     return { user: currentUser };
 *   })
 */
export const authContext = new Elysia({ name: "auth-context" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const currentUser = await resolveCurrentUser(request.headers);
		return { currentUser };
	},
);

// Read-only views into the in-memory user store. Used by routes that
// need to look up other users (e.g. messaging recipients).

export function listAllUsers(): AppUser[] {
	return Array.from(usersByXorsId.values());
}

export function findUserById(id: string): AppUser | null {
	for (const user of usersByXorsId.values()) {
		if (user.id === id) return user;
	}
	return null;
}

export function findUserByEmail(email: string): AppUser | null {
	return usersByEmail.get(email.toLowerCase()) ?? null;
}
