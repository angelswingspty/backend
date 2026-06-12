import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { getAllowedOrigins, loadEnv } from "../config/env.js";

const securityPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv();
  const allowedOrigins = getAllowedOrigins(env);

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "15 minutes",
  });
};

export default fp(securityPlugin, { name: "security" });
