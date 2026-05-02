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

// Test bypass: when TEST_USER_EMAIL is set the server treats every request as
// authenticated as that synthetic user. Used by /tmp/ember-e2e.sh and local
// curl-driven flows where standing up real XORS auth is overkill.
function syntheticTestUser(): AppUser | null {
	const email = process.env.TEST_USER_EMAIL?.toLowerCase();
	if (!email) return null;
	const xorsUserId = `test_${email}`;
	const existing = usersByXorsId.get(xorsUserId);
	if (existing) return existing;
	const fresh: AppUser = {
		id: generateLocalUserId(),
		email,
		displayName: null,
		createdAt: new Date().toISOString(),
		xorsUserId,
	};
	usersByXorsId.set(xorsUserId, fresh);
	usersByEmail.set(email, fresh);
	return fresh;
}

async function resolveCurrentUser(headers: Headers): Promise<AppUser | null> {
	const sessionKey = readCookie(headers, XORS_SESSION_COOKIE);
	if (sessionKey) {
		const viewer = await fetchXorsViewer(sessionKey);
		if (viewer) return upsertFromViewer(viewer);
	}
	return syntheticTestUser();
}

export const authContext = new Elysia({ name: "auth-context" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const currentUser = await resolveCurrentUser(request.headers);
		return { currentUser };
	},
);

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
