import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createDatabase } from "../db/index.js";
import { getDatabaseUrl, getMockSchemaName, loadEnv } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof createDatabase>["db"];
    dbSchema: string;
  }
}

const databasePlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv();
  const schemaName = getMockSchemaName(env);
  const { pool, db } = createDatabase(getDatabaseUrl(env), schemaName);

  app.decorate("db", db);
  app.decorate("dbSchema", schemaName);

  app.log.info({ schema: schemaName }, "Using isolated PostgreSQL schema");

  app.addHook("onClose", async () => {
    await pool.end();
  });
};

export default fp(databasePlugin, { name: "database" });
