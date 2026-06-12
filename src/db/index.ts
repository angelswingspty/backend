import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { getMockSchemaName, getPgSsl } from "../config/env.js";

const { Pool } = pg;

export type Database = ReturnType<typeof drizzle<typeof schema>>;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function createPool(
  connectionString: string,
  schemaName: string,
  ssl: false | { rejectUnauthorized: boolean } = false,
): pg.Pool {
  const pool = new Pool({ connectionString, ssl });

  pool.on("connect", (client) => {
    void client.query(`SET search_path TO ${quoteIdent(schemaName)}, public`);
  });

  return pool;
}

export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}

export function createDatabase(connectionString: string, schemaName?: string) {
  const mockSchema = schemaName ?? getMockSchemaName();
  const pool = createPool(connectionString, mockSchema, getPgSsl());
  return { pool, db: createDb(pool), schemaName: mockSchema };
}

export * from "./schema/index.js";
