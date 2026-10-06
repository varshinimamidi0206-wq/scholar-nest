import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set before the database can be used.",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ...(process.env.SUPABASE_DB_URL
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
