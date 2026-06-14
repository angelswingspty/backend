import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import {
  getBearerToken,
  getClientIp,
  getUserAgent,
  makeTelehealthToken,
} from "../lib/auth-utils.js";
import {
  createAndSendEmailOtp,
  verifyEmailOtp,
} from "../lib/email-otp.js";
import { EmailDeliveryError, isEmailConfigured } from "../lib/email.js";
import { logAudit } from "../lib/telehealth-audit.js";
import {
  createTelehealthSession,
  hashPassword,
  invalidateTelehealthSession,
  validateTelehealthSession,
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
    profilePictureUrl: user.profilePictureUrl,
    mfaEnabled: user.mfaEnabled,
    notifyEmail: user.notifyEmail,
    notifyAppointments: user.notifyAppointments,
    notifyMessages: user.notifyMessages,
    notifySecurity: user.notifySecurity,
  };
}

async function loadTelehealthSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const token = getBearerToken(request.headers.authorization);
  if (!token) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }

  const session = await validateTelehealthSession(request.server.db, token);
  if (!session) {
    reply
      .status(401)
      .send({ error: "Session expired or invalid. Please log in again." });
    return false;
  }

  const [user] = await request.server.db
    .select()
    .from(telehealthUsersTable)
    .where(eq(telehealthUsersTable.id, session.userId))
    .limit(1);

  if (!user) {
    reply.status(401).send({ error: "User not found" });
    return false;
  }

  request.telehealthUser = user;
  request.telehealthSession = session;
  return true;
}

async function requireTelehealthAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await loadTelehealthSession(request, reply);
}

async function requireVerifiedTelehealthAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const ok = await loadTelehealthSession(request, reply);
  if (!ok || reply.sent) return;

  if (!request.telehealthSession!.otpVerified) {
    reply.status(403).send({
      error: "Email verification required",
      mfaRequired: true,
    });
    return;
  }

  await logAudit(request.server.db, "PHI_ACCESS", {
    userId: request.telehealthUser!.id,
    resourceType: "endpoint",
    resourceId: `${request.method} ${request.url}`,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });
}

declare module "fastify" {
  interface FastifyRequest {
    telehealthUser?: typeof telehealthUsersTable.$inferSelect;
    telehealthSession?: { userId: number; role: string; otpVerified: boolean };
  }
}

async function issueEmailOtpChallenge(
  app: Parameters<FastifyPluginAsync>[0],
  request: FastifyRequest,
  reply: FastifyReply,
  user: typeof telehealthUsersTable.$inferSelect,
  token: string,
) {
  if (!isEmailConfigured()) {
    return reply.status(503).send({
      error:
        "Email delivery is not configured. An administrator must set RESEND_API_KEY or SMTP credentials before users can sign in.",
    });
  }

  let otpResult;
  try {
    otpResult = await createAndSendEmailOtp(app.db, user);
  } catch (error) {
    request.log.error({ err: error, userId: user.id }, "Failed to send email OTP");
    const message =
      error instanceof EmailDeliveryError
        ? error.message
        : "Unable to send verification email. Please try again.";
    return reply.status(503).send({ error: message });
  }

  if (!user.mfaEnabled) {
    await app.db
      .update(telehealthUsersTable)
      .set({ mfaEnabled: true })
      .where(eq(telehealthUsersTable.id, user.id));
  }

  return {
    token,
    user: safeUser({ ...user, mfaEnabled: true }),
    mfaRequired: true,
    emailOtpSent: true,
    maskedEmail: otpResult.maskedEmail,
  };
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
        mfaEnabled: true,
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
      false,
    );

    await logAudit(app.db, "REGISTER", {
      userId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    const challenge = await issueEmailOtpChallenge(app, request, reply, user, token);
    if (reply.sent) return;
    return reply.status(201).send(challenge);
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
      false,
    );

    await logAudit(app.db, "LOGIN", {
      userId: user.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    const challenge = await issueEmailOtpChallenge(app, request, reply, user, token);
    if (reply.sent) return;
    return challenge;
  });

  app.post(
    "/telehealth/auth/mfa/setup",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const user = request.telehealthUser!;

      if (!isEmailConfigured()) {
        return reply.status(503).send({
          error:
            "Email delivery is not configured. An administrator must set RESEND_API_KEY or SMTP credentials.",
        });
      }

      let otpResult;
      try {
        otpResult = await createAndSendEmailOtp(app.db, user);
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, "Failed to resend email OTP");
        const message =
          error instanceof EmailDeliveryError
            ? error.message
            : "Unable to send verification email. Please try again.";
        return reply.status(503).send({ error: message });
      }

      await logAudit(app.db, "EMAIL_OTP_SENT", {
        userId: user.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });

      return {
        message: "Verification code sent to your email",
        emailSent: true,
        maskedEmail: otpResult.maskedEmail,
      };
    },
  );

  app.post(
    "/telehealth/auth/mfa/verify",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const body = request.body as { code?: string };
      const user = request.telehealthUser!;
      const code = String(body.code ?? "").trim();
      const currentToken = getBearerToken(request.headers.authorization)!;

      if (!/^\d{6}$/.test(code)) {
        return reply
          .status(400)
          .send({ error: "Enter the 6-digit code from your email" });
      }

      const result = await verifyEmailOtp(app.db, user.id, code);

      if (result === "expired") {
        return reply
          .status(401)
          .send({ error: "This code has expired. Request a new one." });
      }

      if (result === "locked") {
        return reply.status(429).send({
          error: "Too many failed attempts. Request a new code and try again.",
        });
      }

      if (result === "invalid") {
        await logAudit(app.db, "EMAIL_OTP_VERIFY_FAILED", {
          userId: user.id,
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });
        return reply.status(401).send({ error: "Invalid verification code" });
      }

      await invalidateTelehealthSession(app.db, currentToken);

      await logAudit(app.db, "EMAIL_OTP_VERIFIED", {
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
        true,
      );

      return {
        token,
        user: safeUser({ ...user, mfaEnabled: true }),
        otpVerified: true,
      };
    },
  );

  app.get(
    "/telehealth/auth/me",
    { preHandler: requireTelehealthAuth },
    async (request) => ({
      ...safeUser(request.telehealthUser!),
      otpVerified: request.telehealthSession!.otpVerified,
    }),
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

export { requireTelehealthAuth, requireVerifiedTelehealthAuth, safeUser as publicTelehealthUser };
