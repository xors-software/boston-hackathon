// Tiny SQL migration runner. Reads .sql files from ./migrations and
// applies any not yet recorded in `schema_migrations`. Compatible with
// the manual convention used for `001_init` on the existing Railway DB.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error(
		"DATABASE_URL is not set. Set it to the Postgres connection string.",
	);
	process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

async function ensureSchemaMigrationsTable(): Promise<void> {
	await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function appliedMigrations(): Promise<Set<string>> {
	const rows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
	return new Set(rows.map((r) => r.name));
}

async function migrationsDir(): Promise<string> {
	const here = dirname(fileURLToPath(import.meta.url));
	return join(here, "migrations");
}

async function listMigrationFiles(): Promise<string[]> {
	const dir = await migrationsDir();
	const entries = await readdir(dir);
	return entries.filter((f) => f.endsWith(".sql")).sort();
}

async function applyMigration(name: string): Promise<void> {
	const dir = await migrationsDir();
	const body = await readFile(join(dir, name), "utf8");
	console.log(`[migrate] applying ${name}`);
	await sql.begin(async (tx) => {
		await tx.unsafe(body);
		await tx`INSERT INTO schema_migrations (name) VALUES (${nameWithoutExt(name)})`;
	});
	console.log(`[migrate] applied  ${name}`);
}

function nameWithoutExt(file: string): string {
	return file.replace(/\.sql$/, "");
}

async function main(): Promise<void> {
	await ensureSchemaMigrationsTable();
	const applied = await appliedMigrations();
	const files = await listMigrationFiles();
	const pending = files.filter((f) => !applied.has(nameWithoutExt(f)));
	if (pending.length === 0) {
		console.log("[migrate] nothing to do — all migrations already applied");
		return;
	}
	for (const name of pending) {
		await applyMigration(name);
	}
	console.log(`[migrate] done — applied ${pending.length} migration(s)`);
}

main()
	.catch((err) => {
		console.error("[migrate] failed:", err);
		process.exit(1);
	})
	.finally(() => sql.end());
