import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error(
		"DATABASE_URL is not set. Set it to a Postgres connection string (e.g. postgresql://localhost:5432/ember_dev).",
	);
}

// Single connection for the dev/hackathon scope. Bump max for prod.
export const sqlClient = postgres(url, { max: 5, prepare: false });

export const db = drizzle(sqlClient, { schema });

export type Db = typeof db;
