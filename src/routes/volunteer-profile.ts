import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getBearerToken, hashToken } from "../lib/auth-utils.js";
import { initialsFromName, validateProfilePicture } from "../lib/profile-utils.js";
import { volSessionsTable, volUsersTable } from "../db/schema/volunteer-portal.js";
import { publicVolUser, requireVolunteerAuth } from "./volunteer-auth.js";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  skills: z.string().trim().max(500).nullable().optional(),
  availability: z.string().trim().max(500).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  notifyEmail: z.boolean().optional(),
  notifyEvents: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

const accountActionSchema = z.object({
  password: z.string().min(1),
});

async function invalidateAllVolSessions(
  db: Parameters<FastifyPluginAsync>[0]["db"],
  userId: number,
) {
  await db.delete(volSessionsTable).where(eq(volSessionsTable.userId, userId));
}

export const volunteerProfileRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/volunteers/profile",
    { preHandler: requireVolunteerAuth },
    async (request) => publicVolUser(request.volUser!),
  );

  app.patch(
    "/volunteers/profile",
    { preHandler: requireVolunteerAuth },
    async (request, reply) => {
      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid profile data",
          details: parsed.error.flatten(),
        });
      }

      const user = request.volUser!;
      const data = parsed.data;
      const updates: Partial<typeof volUsersTable.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (data.name !== undefined) {
        updates.name = data.name;
        updates.avatarInitials = initialsFromName(data.name);
      }
      if (data.email !== undefined) {
        const normalized = data.email.toLowerCase();
        const [existing] = await app.db
          .select({ id: volUsersTable.id })
          .from(volUsersTable)
          .where(eq(volUsersTable.email, normalized))
          .limit(1);
        if (existing && existing.id !== user.id) {
          return reply.status(409).send({ error: "Email is already in use" });
        }
        updates.email = normalized;
      }
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.skills !== undefined) updates.skills = data.skills;
      if (data.availability !== undefined) updates.availability = data.availability;
      if (data.bio !== undefined) updates.bio = data.bio;
      if (data.notifyEmail !== undefined) updates.notifyEmail = data.notifyEmail;
      if (data.notifyEvents !== undefined) updates.notifyEvents = data.notifyEvents;
      if (data.notifyMessages !== undefined) updates.notifyMessages = data.notifyMessages;

      if (data.profilePictureUrl !== undefined) {
        try {
          updates.profilePictureUrl = validateProfilePicture(data.profilePictureUrl);
        } catch (error) {
          return reply.status(400).send({
            error: error instanceof Error ? error.message : "Invalid profile picture",
          });
        }
      }

      const [updated] = await app.db
        .update(volUsersTable)
        .set(updates)
        .where(eq(volUsersTable.id, user.id))
        .returning();

      if (!updated) {
        return reply.status(500).send({ error: "Failed to update profile" });
      }

      return publicVolUser(updated);
    },
  );

  app.post(
    "/volunteers/profile/password",
    { preHandler: requireVolunteerAuth },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid password data" });
      }

      const { currentPassword, newPassword, confirmPassword } = parsed.data;
      if (newPassword !== confirmPassword) {
        return reply.status(400).send({ error: "New passwords do not match" });
      }

      const user = request.volUser!;
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await app.db
        .update(volUsersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(volUsersTable.id, user.id));

      return { message: "Password updated successfully" };
    },
  );

  app.post(
    "/volunteers/profile/deactivate",
    { preHandler: requireVolunteerAuth },
    async (request, reply) => {
      const parsed = accountActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Password is required" });
      }

      const user = request.volUser!;
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Password is incorrect" });
      }

      await app.db
        .update(volUsersTable)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(volUsersTable.id, user.id));

      const token = getBearerToken(request.headers.authorization);
      if (token) {
        await app.db
          .delete(volSessionsTable)
          .where(eq(volSessionsTable.tokenHash, hashToken(token)));
      }

      return { message: "Account deactivated" };
    },
  );

  app.delete(
    "/volunteers/profile",
    { preHandler: requireVolunteerAuth },
    async (request, reply) => {
      const parsed = accountActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Password is required to delete account" });
      }

      const user = request.volUser!;
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Password is incorrect" });
      }

      await invalidateAllVolSessions(app.db, user.id);
      await app.db.delete(volUsersTable).where(eq(volUsersTable.id, user.id));

      return { message: "Account deleted permanently" };
    },
  );
};
