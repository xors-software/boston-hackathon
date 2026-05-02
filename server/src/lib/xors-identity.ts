import { Elysia } from "elysia";
import { readCookie } from "./cookies";
import { getSql } from "./pg";

const XORS_API_URL =
	process.env.XORS_API_URL ||
	process.env.NEXT_PUBLIC_XORS_API_URL ||
	"https://api.xors.xyz";

export const XORS_SESSION_COOKIE = "xors_session";

// AppUser.id IS the xors_user_id — single identity column, no local
// indirection. Cross-references between tables (messages.from/to,
// future FKs) all use this column directly.
export interface AppUser {
	id: string;
	email: string;
	displayName: string | null;
	createdAt: string;
}

interface XorsViewer {
	id: string;
	email?: string;
	username?: string | null;
	level?: string | number | null;
}

interface UserRow {
	xors_user_id: string;
	email: string;
	display_name: string | null;
	created_at: Date | string;
}

function rowToUser(r: UserRow): AppUser {
	return {
		id: r.xors_user_id,
		email: r.email,
		displayName: r.display_name,
		createdAt:
			r.created_at instanceof Date
				? r.created_at.toISOString()
				: r.created_at,
	};
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

async function upsertFromViewer(viewer: XorsViewer): Promise<AppUser> {
	const sql = getSql();
	const email = (viewer.email ?? "").toLowerCase();
	const displayName = viewer.username ?? null;

	// Upsert keyed on xors_user_id. ON CONFLICT keeps email/display_name
	// fresh — drift at xors propagates here on the next sign-in.
	const rows = await sql<UserRow[]>`
		INSERT INTO users (xors_user_id, email, display_name)
		VALUES (${viewer.id}, ${email}, ${displayName})
		ON CONFLICT (xors_user_id) DO UPDATE
		SET email        = EXCLUDED.email,
		    display_name = EXCLUDED.display_name
		RETURNING xors_user_id, email, display_name, created_at
	`;
	return rowToUser(rows[0]);
}

async function resolveCurrentUser(headers: Headers): Promise<AppUser | null> {
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

// Read views for routes that need to look up other users.

export async function listAllUsers(): Promise<AppUser[]> {
	const sql = getSql();
	const rows = await sql<UserRow[]>`
		SELECT xors_user_id, email, display_name, created_at
		FROM users
		ORDER BY created_at DESC
	`;
	return rows.map(rowToUser);
}

export async function findUserById(xorsUserId: string): Promise<AppUser | null> {
	const sql = getSql();
	const rows = await sql<UserRow[]>`
		SELECT xors_user_id, email, display_name, created_at
		FROM users WHERE xors_user_id = ${xorsUserId}
	`;
	return rows.length ? rowToUser(rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
	const sql = getSql();
	const rows = await sql<UserRow[]>`
		SELECT xors_user_id, email, display_name, created_at
		FROM users WHERE email = ${email.toLowerCase()}
		LIMIT 1
	`;
	return rows.length ? rowToUser(rows[0]) : null;
}
