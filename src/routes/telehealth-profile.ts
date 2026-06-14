import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getBearerToken } from "../lib/auth-utils.js";
import { hashPassword } from "../lib/telehealth-crypto.js";
import { invalidateTelehealthSession } from "../lib/telehealth-crypto.js";
import { validateProfilePicture } from "../lib/profile-utils.js";
import { telehealthUsersTable } from "../db/schema/telehealth.js";
import {
  publicTelehealthUser,
  requireTelehealthAuth,
} from "./telehealth-auth.js";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  specialty: z.string().trim().max(200).nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  mfaEnabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyAppointments: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
  notifySecurity: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

const accountActionSchema = z.object({
  password: z.string().min(1),
});

export const telehealthProfileRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/telehealth/profile",
    { preHandler: requireTelehealthAuth },
    async (request) => publicTelehealthUser(request.telehealthUser!),
  );

  app.patch(
    "/telehealth/profile",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid profile data",
          details: parsed.error.flatten(),
        });
      }

      const user = request.telehealthUser!;
      const data = parsed.data;
      const updates: Partial<typeof telehealthUsersTable.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (data.name !== undefined) updates.name = data.name;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.specialty !== undefined) updates.specialty = data.specialty;
      if (data.mfaEnabled !== undefined) updates.mfaEnabled = data.mfaEnabled;
      if (data.notifyEmail !== undefined) updates.notifyEmail = data.notifyEmail;
      if (data.notifyAppointments !== undefined) {
        updates.notifyAppointments = data.notifyAppointments;
      }
      if (data.notifyMessages !== undefined) updates.notifyMessages = data.notifyMessages;
      if (data.notifySecurity !== undefined) updates.notifySecurity = data.notifySecurity;

      if (data.email !== undefined) {
        const normalized = data.email.toLowerCase();
        const [existing] = await app.db
          .select({ id: telehealthUsersTable.id })
          .from(telehealthUsersTable)
          .where(eq(telehealthUsersTable.email, normalized))
          .limit(1);
        if (existing && existing.id !== user.id) {
          return reply.status(409).send({ error: "Email is already in use" });
        }
        updates.email = normalized;
      }

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
        .update(telehealthUsersTable)
        .set(updates)
        .where(eq(telehealthUsersTable.id, user.id))
        .returning();

      if (!updated) {
        return reply.status(500).send({ error: "Failed to update profile" });
      }

      return publicTelehealthUser(updated);
    },
  );

  app.post(
    "/telehealth/profile/password",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid password data" });
      }

      const { currentPassword, newPassword, confirmPassword } = parsed.data;
      if (newPassword !== confirmPassword) {
        return reply.status(400).send({ error: "New passwords do not match" });
      }

      const user = request.telehealthUser!;
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Current password is incorrect" });
      }

      const passwordHash = await hashPassword(newPassword);
      await app.db
        .update(telehealthUsersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(telehealthUsersTable.id, user.id));

      return { message: "Password updated successfully" };
    },
  );

  app.post(
    "/telehealth/profile/deactivate",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const parsed = accountActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Password is required" });
      }

      const user = request.telehealthUser!;
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Password is incorrect" });
      }

      await app.db
        .update(telehealthUsersTable)
        .set({ mfaEnabled: false, updatedAt: new Date() })
        .where(eq(telehealthUsersTable.id, user.id));

      const token = getBearerToken(request.headers.authorization);
      if (token) {
        await invalidateTelehealthSession(app.db, token);
      }

      return { message: "Account deactivated. Contact support to reactivate." };
    },
  );

  app.delete(
    "/telehealth/profile",
    { preHandler: requireTelehealthAuth },
    async (request, reply) => {
      const parsed = accountActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Password is required to delete account" });
      }

      const user = request.telehealthUser!;
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Password is incorrect" });
      }

      const token = getBearerToken(request.headers.authorization);
      if (token) {
        await invalidateTelehealthSession(app.db, token);
      }

      await app.db
        .delete(telehealthUsersTable)
        .where(eq(telehealthUsersTable.id, user.id));

      return { message: "Account deleted permanently" };
    },
  );
};
