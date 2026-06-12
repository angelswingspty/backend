import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import pg from "pg";
import "dotenv/config";
import { getDatabaseUrl, getMockSchemaName, getPgSsl, loadEnv } from "../config/env.js";

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

const env = loadEnv();
const schemaName = getMockSchemaName(env);
const pool = new pg.Pool({
  connectionString: getDatabaseUrl(env),
  ssl: getPgSsl(env),
});
const db = drizzle(pool);

await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);
await db.execute(
  sql.raw(`SET search_path TO ${quoteIdent(schemaName)}, public`),
);

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

await migrate(db, { migrationsFolder });
await pool.end();

console.log(`Database migrations applied to schema "${schemaName}"`);
