import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async (_request, reply) => {
    let database: "ok" | "unavailable" = "ok";

    try {
      await app.db.execute(sql`SELECT 1`);
    } catch {
      database = "unavailable";
    }

    const body = {
      status: database === "ok" ? "ok" : "degraded",
      database,
      schema: app.dbSchema,
    };

    if (database === "unavailable") {
      return reply.status(503).send(body);
    }

    return body;
  });
};
