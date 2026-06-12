import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { getDatabaseUrl, loadEnv } from "./src/config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnv();

export default defineConfig({
  schema: path.join(__dirname, "./src/db/schema/index.ts"),
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  schemaFilter: [process.env.PG_MOCK_SCHEMA?.trim() || "ghri_mock"],
});
