import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is not set. Provision a Postgres on Railway (or run one locally) and set DATABASE_URL.",
	);
}

export const sql = postgres(DATABASE_URL, {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});

export type Sql = typeof sql;
