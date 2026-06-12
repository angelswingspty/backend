import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import {
  getBearerToken,
  getClientIp,
  getUserAgent,
  makeTelehealthToken,
} from "../lib/auth-utils.js";
import { logAudit } from "../lib/telehealth-audit.js";
import {
  createTelehealthSession,
  generateBackupCodes,
  generateMfaSecret,
  getMfaOtpauthUrl,
  hashPassword,
  invalidateTelehealthSession,
  validateTelehealthSession,
  verifyMfaToken,
  verifyPassword,
} from "../lib/telehealth-crypto.js";
import {
  consentRecordsTable,
  telehealthUsersTable,
} from "../db/schema/telehealth.js";

function safeUser(user: typeof telehealthUsersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
    phone: user.phone,
    mfaEnabled: user.mfaEnabled,
  };
}

async function requireTelehealthAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = getBearerToken(request.headers.authorization);
  if (!token) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  const session = await validateTelehealthSession(request.server.db, token);
  if (!session) {
    return reply
      .status(401)
      .send({ error: "Session expired or invalid. Please log in again." });
  }

  const [user] = await request.server.db
    .select()
    .from(telehealthUsersTable)
    .where(eq(telehealthUsersTable.id, session.userId))
    .limit(1);

  if (!user) {
    return reply.status(401).send({ error: "User not found" });
  }

  request.telehealthUser = user;

  await logAudit(request.server.db, "PHI_ACCESS", {
    userId: user.id,
    resourceType: "endpoint",
    resourceId: `${request.method} ${request.url}`,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });
}

declare module "fastify" {
  interface FastifyRequest {
    telehealthUser?: typeof telehealthUsersTable.$inferSelect;
  }
}

export const telehealthAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/telehealth/auth/register", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      specialty?: string;
      phone?: string;
      consentedToTerms?: boolean;
    };

    const { email, password, name, role, specialty, phone, consentedToTerms } =
      body;

    if (!email || !password || !name || !role) {
      return reply
        .status(400)
        .send({ error: "Email, password, name, and role are required" });
    }
    if (!["patient", "provider"].includes(role)) {
      return reply.status(400).send({ error: "Role must be patient or provider" });
    }
    if (password.length < 8) {
      return reply
        .status(400)
        .send({ error: "Password must be at least 8 characters" });
    }
    if (!consentedToTerms) {
      return reply
        .status(400)
        .send({ error: "You must consent to the terms and privacy policy" });
    }

    const normalizedEmail = email.toLowerCase();
    const [existing] = await app.db
      .select({ id: telehealthUsersTable.id })
      .from(telehealthUsersTable)
      .where(eq(telehealthUsersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return reply
        .status(409)
        .send({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await app.db
      .insert(telehealthUsersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        name,
        role: role as "patient" | "provider",
        specialty: specialty ?? null,
        phone: phone ?? null,
        consentedAt: new Date(),
      })
      .returning();

    if (!user) {
      return reply.status(500).send({ error: "Failed to create account" });
    }

    await app.db.insert(consentRecordsTable).values({
      userId: user.id,
      formType: "terms_and_privacy",
      consented: true,
      ipAddress: getClientIp(request),
    });

    const token = makeTelehealthToken(user.id, user.role);
    await createTelehealthSession(
      app.db,
      user.id,
      token,
      getClientIp(request),
      getUserAgent(request),
    );

    await logAudit(app.db, "REGISTER", {
      userId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(201).send({ token, user: safeUser(user) });
  });

  app.post("/telehealth/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const [user] = await app.db
      .select()
      .from(telehealthUsersTable)
      .where(eq(telehealthUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAudit(app.db, "LOGIN_FAILED", {
        userId: user.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = makeTelehealthToken(user.id, user.role);
    await createTelehealthSession(
      app.db,
      user.id,
      token,
      getClientIp(request),
      getUserAgent(request),
    );

    await logAudit(app.db, "LOGIN", {
      userId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return {
      token,
      user: safeUser(user),
      mfaRequired: user.mfaEnabled,
      mfaSetupRequired: !user.mfaEnabled,
    };
  });

  app.post(
    "/telehealth/auth/mfa/setup",
    { preHandler: requireTelehealthAuth },
    async (request) => {
      const user = request.telehealthUser!;
      const secret = generateMfaSecret();
      const backupCodes = generateBackupCodes();

      await app.db
        .update(telehealthUsersTable)
        .set({ mfaSecret: secret, mfaBackupCodes: JSON.stringify(backupCodes) })
        .where(eq(telehealthUsersTable.id, user.id));

      await logAudit(app.db, "MFA_SETUP_INITIATED", {
        userId: user.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return {
        secret,
        otpauthUrl: getMfaOtpauthUrl(secret, user.email),
        backupCodes,
      };
    },
  );

  app.post(
    "/telehealth/auth/mfa/verify",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const body = request.body as { code?: string; action?: string };
      const user = request.telehealthUser!;

      if (!user.mfaSecret) {
        return reply
          .status(400)
          .send({ error: "MFA not set up. Call /mfa/setup first." });
      }

      const valid = verifyMfaToken(user.mfaSecret, String(body.code ?? ""));
      if (!valid) {
        await logAudit(app.db, "MFA_VERIFY_FAILED", {
          userId: user.id,
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
        return reply.status(401).send({ error: "Invalid authentication code" });
      }

      if (body.action === "enable" || !body.action) {
        await app.db
          .update(telehealthUsersTable)
          .set({ mfaEnabled: true })
          .where(eq(telehealthUsersTable.id, user.id));
      }

      await logAudit(app.db, "MFA_VERIFIED", {
        userId: user.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      const token = makeTelehealthToken(user.id, user.role);
      await createTelehealthSession(
        app.db,
        user.id,
        token,
        getClientIp(request),
        getUserAgent(request),
      );

      return {
        token,
        user: safeUser({ ...user, mfaEnabled: true }),
      };
    },
  );

  app.get(
    "/telehealth/auth/me",
    { preHandler: requireTelehealthAuth },
    async (request) => safeUser(request.telehealthUser!),
  );

  app.post(
    "/telehealth/auth/logout",
    { preHandler: requireTelehealthAuth },
    async (request) => {
      const token = getBearerToken(request.headers.authorization)!;
      await invalidateTelehealthSession(app.db, token);
      await logAudit(app.db, "LOGOUT", {
        userId: request.telehealthUser!.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
      return { message: "Logged out successfully" };
    },
  );
};
