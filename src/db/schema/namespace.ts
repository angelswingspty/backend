import { pgSchema } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schema for the mock GHRI application.
 * Kept separate from PG_SCHEMA (e.g. GHRIAPP) so RDS dev data is never touched.
 */
export const MOCK_SCHEMA_NAME =
  process.env.PG_MOCK_SCHEMA?.trim() || "ghri_mock";

export const app = pgSchema(MOCK_SCHEMA_NAME);
