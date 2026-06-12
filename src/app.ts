import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { loadEnv, isProduction } from "./config/env.js";
import { logger } from "./lib/logger.js";
import databasePlugin from "./plugins/database.js";
import securityPlugin from "./plugins/security.js";
import { apiRoutes } from "./routes/index.js";

export async function buildApp() {
  const env = loadEnv();

  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  await app.register(sensible);

  await app.register(securityPlugin);
  await app.register(databasePlugin);

  await app.register(apiRoutes, { prefix: "/api" });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: "Not found" });
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      app.log.error(error);
    }

    reply.status(statusCode).send({
      error:
        isProduction(env) && statusCode >= 500
          ? "Internal server error"
          : error.message,
    });
  });

  return app;
}
