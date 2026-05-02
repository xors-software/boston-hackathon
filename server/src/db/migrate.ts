import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "./index";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function runMigrations(): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS _migrations (
			filename text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`;

	const files = (await readdir(MIGRATIONS_DIR))
		.filter((f) => f.endsWith(".sql"))
		.sort();

	const applied = new Set(
		(await sql<{ filename: string }[]>`SELECT filename FROM _migrations`).map(
			(r) => r.filename,
		),
	);

	for (const file of files) {
		if (applied.has(file)) continue;
		const path = join(MIGRATIONS_DIR, file);
		const body = await readFile(path, "utf8");
		console.log(`[migrate] applying ${file}`);
		await sql.begin(async (tx) => {
			await tx.unsafe(body);
			await tx`INSERT INTO _migrations (filename) VALUES (${file})`;
		});
	}
}
