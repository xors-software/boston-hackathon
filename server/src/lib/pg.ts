// Single shared Postgres client for the app. Created lazily so unit
// tests that don't touch the DB (the 401 / cookie-parsing tests) can
// import this module without forcing a connection.
//
// The migration runner is idempotent — every CREATE uses IF NOT EXISTS
// so calling runMigrations() on every boot is safe. Migrations live as
// inline SQL because we only have one for now; once we accumulate a
// handful, splitting into numbered files becomes worthwhile.

import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
	if (_sql) return _sql;
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"DATABASE_URL is not set — required for any DB-backed route. " +
				"Set it in .env.local (see .env.example).",
		);
	}
	_sql = postgres(url, {
		// Idle connections close fast in serverless-ish setups; Railway's
		// connection limits are tight, so don't keep many around.
		max: 10,
		idle_timeout: 20,
		connect_timeout: 10,
	});
	return _sql;
}

export async function closeSql(): Promise<void> {
	if (_sql) {
		await _sql.end({ timeout: 5 });
		_sql = null;
	}
}

const MIGRATIONS: Array<{ name: string; sql: string }> = [
	{
		name: "001_init",
		sql: `
			CREATE TABLE IF NOT EXISTS users (
				xors_user_id TEXT PRIMARY KEY,
				email        TEXT NOT NULL,
				display_name TEXT,
				created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

			CREATE TABLE IF NOT EXISTS messages (
				id                 TEXT PRIMARY KEY,
				from_xors_user_id  TEXT NOT NULL REFERENCES users (xors_user_id) ON DELETE CASCADE,
				to_xors_user_id    TEXT NOT NULL REFERENCES users (xors_user_id) ON DELETE CASCADE,
				content            TEXT NOT NULL,
				created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE INDEX IF NOT EXISTS messages_from_idx ON messages (from_xors_user_id, created_at);
			CREATE INDEX IF NOT EXISTS messages_to_idx   ON messages (to_xors_user_id, created_at);
		`,
	},
];

/**
 * Run every migration in order, recording applied names in
 * schema_migrations so re-running on boot is a no-op.
 */
export async function runMigrations(): Promise<void> {
	const sql = getSql();
	await sql.unsafe(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name        TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);
	const applied = await sql<{ name: string }[]>`
		SELECT name FROM schema_migrations
	`;
	const appliedSet = new Set(applied.map((r) => r.name));
	for (const m of MIGRATIONS) {
		if (appliedSet.has(m.name)) continue;
		console.log(`[pg] applying migration ${m.name}`);
		await sql.unsafe(m.sql);
		await sql`INSERT INTO schema_migrations (name) VALUES (${m.name})`;
	}
}

/**
 * Try migrations a few times on cold boot — Railway can race the DB
 * during deploy. Falls through to throw on persistent failure so the
 * server fails loud instead of serving with a broken schema.
 */
export async function runMigrationsWithRetry(
	attempts = 5,
	baseDelayMs = 500,
): Promise<void> {
	let lastErr: unknown = null;
	for (let i = 0; i < attempts; i++) {
		try {
			await runMigrations();
			return;
		} catch (err) {
			lastErr = err;
			console.warn(
				`[pg] migration attempt ${i + 1}/${attempts} failed:`,
				err instanceof Error ? err.message : err,
			);
			if (i < attempts - 1) {
				await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
			}
		}
	}
	throw lastErr;
}
