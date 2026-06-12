import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import {
  getBearerToken,
  getClientIp,
  hashToken,
  makeVolunteerToken,
  verifyVolunteerToken,
} from "../lib/auth-utils.js";
import { volSessionsTable, volUsersTable } from "../db/schema/volunteer-portal.js";

const SESSION_MS = 24 * 60 * 60 * 1000;

function publicUser(user: typeof volUsersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    avatarInitials: user.avatarInitials,
    skills: user.skills,
    availability: user.availability,
    bio: user.bio,
  };
}

async function requireVolunteerAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = getBearerToken(request.headers.authorization);
  if (!token) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const payload = verifyVolunteerToken(token);
  if (!payload) {
    return reply.status(401).send({ error: "Invalid token" });
  }

  const [session] = await request.server.db
    .select()
    .from(volSessionsTable)
    .where(
      and(
        eq(volSessionsTable.tokenHash, hashToken(token)),
        gt(volSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    return reply.status(401).send({ error: "Session expired" });
  }

  const [user] = await request.server.db
    .select()
    .from(volUsersTable)
    .where(eq(volUsersTable.id, payload.sub))
    .limit(1);

  if (!user) {
    return reply.status(401).send({ error: "User not found" });
  }

  request.volUser = user;
}

declare module "fastify" {
  interface FastifyRequest {
    volUser?: typeof volUsersTable.$inferSelect;
  }
}

export const volunteerAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/volunteers/auth/register", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
      skills?: string;
      availability?: string;
      consentedToTerms?: boolean;
    };

    const { email, password, name, phone, skills, availability, consentedToTerms } =
      body;

    if (!email || !password || !name) {
      return reply
        .status(400)
        .send({ error: "email, password, and name are required" });
    }
    if (!consentedToTerms) {
      return reply.status(400).send({ error: "You must consent to the terms" });
    }
    if (password.length < 8) {
      return reply
        .status(400)
        .send({ error: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase();
    const [existing] = await app.db
      .select({ id: volUsersTable.id })
      .from(volUsersTable)
      .where(eq(volUsersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return reply
        .status(409)
        .send({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const initials = name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const [user] = await app.db
      .insert(volUsersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        name,
        phone: phone ?? null,
        skills: skills ?? null,
        availability: availability ?? null,
        avatarInitials: initials,
        consentedAt: new Date(),
        status: "pending",
        role: "volunteer",
      })
      .returning();

    if (!user) {
      return reply.status(500).send({ error: "Failed to create account" });
    }

    const token = makeVolunteerToken(user.id, user.role);
    await app.db.insert(volSessionsTable).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_MS),
      ipAddress: getClientIp(request),
    });

    return reply.status(201).send({
      token,
      user: publicUser(user),
    });
  });

  app.post("/volunteers/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return reply.status(400).send({ error: "email and password are required" });
    }

    const [user] = await app.db
      .select()
      .from(volUsersTable)
      .where(eq(volUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = makeVolunteerToken(user.id, user.role);
    await app.db.insert(volSessionsTable).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_MS),
      ipAddress: getClientIp(request),
    });

    return {
      token,
      user: publicUser(user),
    };
  });

  app.post("/volunteers/auth/logout", async (request) => {
    const token = getBearerToken(request.headers.authorization);
    if (token) {
      await app.db
        .delete(volSessionsTable)
        .where(eq(volSessionsTable.tokenHash, hashToken(token)));
    }
    return { ok: true };
  });

  app.get(
    "/volunteers/auth/me",
    { preHandler: requireVolunteerAuth },
    async (request) => {
      return publicUser(request.volUser!);
    },
  );
};
