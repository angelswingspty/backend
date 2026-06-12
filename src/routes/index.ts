/**
 * Route registry — mirrors the legacy Express API (see openapi.yaml).
 *
 * Implemented:
 *   - GET  /api/healthz
 *   - POST /api/donations/checkout-session
 *   - POST /api/donations/webhook
 *   - POST /api/volunteers/auth/register|login|logout
 *   - GET  /api/volunteers/auth/me
 *   - POST /api/telehealth/auth/register|login|logout|mfa/*
 *   - GET  /api/telehealth/auth/me
 *
 * Planned (public):
 *   - POST /api/contact
 *   - POST /api/volunteer
 *   - POST /api/newsletter
 *   - GET  /api/stats
 *   - GET  /api/blog
 *
 * Planned (telehealth):
 *   - /api/telehealth/auth/*
 *   - /api/telehealth/appointments*
 *   - /api/telehealth/messages
 *   - /api/telehealth/documents
 *   - /api/telehealth/prescriptions
 *   - /api/telehealth/providers
 *   - /api/telehealth/patients
 *   - /api/telehealth/audit-logs
 *   - /api/telehealth/intake
 *
 * Planned (volunteer portal):
 *   - /api/volunteers/auth/*
 *   - /api/volunteers/training*
 *   - /api/volunteers/waivers*
 *   - /api/volunteers/hours*
 *   - /api/volunteers/events*
 *   - /api/volunteers/messages
 *   - /api/volunteers/impact
 *   - /api/volunteers/coordinators
 *   - /api/volunteers/directory
 */

import type { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";
import { donationRoutes } from "./donations.js";
import { volunteerAuthRoutes } from "./volunteer-auth.js";
import { telehealthAuthRoutes } from "./telehealth-auth.js";

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(donationRoutes);
  await app.register(volunteerAuthRoutes);
  await app.register(telehealthAuthRoutes);

  // TODO: register route modules as they are ported from the Express server
  // await app.register(publicRoutes);
  // await app.register(telehealthRoutes);
  // await app.register(volunteerRoutes);
};
