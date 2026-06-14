import {
    serial,
  text,
  timestamp,
  boolean,
  integer,
  real,
  } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";

export const volRoleEnum = app.enum("vol_role", ["volunteer", "coordinator"]);
export const volStatusEnum = app.enum("vol_status", ["pending", "active", "inactive"]);
export const volHourStatusEnum = app.enum("vol_hour_status", ["pending", "approved", "rejected"]);
export const volEventStatusEnum = app.enum("vol_event_status", ["upcoming", "active", "completed", "cancelled"]);
export const volRegStatusEnum = app.enum("vol_reg_status", ["registered", "attended", "cancelled"]);
export const volResourceTypeEnum = app.enum("vol_resource_type", ["video", "document", "quiz", "article"]);

export const volUsersTable = app.table("vol_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: volRoleEnum("role").default("volunteer").notNull(),
  status: volStatusEnum("status").default("pending").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  skills: text("skills"),
  availability: text("availability"),
  bio: text("bio"),
  avatarInitials: text("avatar_initials"),
  profilePictureUrl: text("profile_picture_url"),
  notifyEmail: boolean("notify_email").default(true).notNull(),
  notifyEvents: boolean("notify_events").default(true).notNull(),
  notifyMessages: boolean("notify_messages").default(true).notNull(),
  consentedAt: timestamp("consented_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const volSessionsTable = app.table("vol_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => volUsersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volTrainingResourcesTable = app.table("vol_training_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  resourceType: volResourceTypeEnum("resource_type").default("document").notNull(),
  url: text("url"),
  durationMinutes: integer("duration_minutes"),
  required: boolean("required").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volTrainingProgressTable = app.table("vol_training_progress", {
  id: serial("id").primaryKey(),
  volunteerId: integer("volunteer_id")
    .notNull()
    .references(() => volUsersTable.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => volTrainingResourcesTable.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  score: integer("score"),
});

export const volWaiversTable = app.table("vol_waivers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: text("version").default("1.0").notNull(),
  required: boolean("required").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volWaiverSignaturesTable = app.table("vol_waiver_signatures", {
  id: serial("id").primaryKey(),
  volunteerId: integer("volunteer_id")
    .notNull()
    .references(() => volUsersTable.id, { onDelete: "cascade" }),
  waiverId: integer("waiver_id")
    .notNull()
    .references(() => volWaiversTable.id, { onDelete: "cascade" }),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  signatureData: text("signature_data"),
});

export const volServiceHoursTable = app.table("vol_service_hours", {
  id: serial("id").primaryKey(),
  volunteerId: integer("volunteer_id")
    .notNull()
    .references(() => volUsersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id"),
  description: text("description").notNull(),
  hours: real("hours").notNull(),
  serviceDate: timestamp("service_date").notNull(),
  status: volHourStatusEnum("status").default("pending").notNull(),
  reviewNotes: text("review_notes"),
  reviewedById: integer("reviewed_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volEventsTable = app.table("vol_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  maxVolunteers: integer("max_volunteers"),
  coordinatorId: integer("coordinator_id").references(() => volUsersTable.id),
  status: volEventStatusEnum("status").default("upcoming").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volEventRegistrationsTable = app.table("vol_event_registrations", {
  id: serial("id").primaryKey(),
  volunteerId: integer("volunteer_id")
    .notNull()
    .references(() => volUsersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id")
    .notNull()
    .references(() => volEventsTable.id, { onDelete: "cascade" }),
  status: volRegStatusEnum("status").default("registered").notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export const volMessagesTable = app.table("vol_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id")
    .notNull()
    .references(() => volUsersTable.id),
  recipientId: integer("recipient_id")
    .notNull()
    .references(() => volUsersTable.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VolUser = typeof volUsersTable.$inferSelect;
export type VolEvent = typeof volEventsTable.$inferSelect;
export type VolServiceHours = typeof volServiceHoursTable.$inferSelect;
export type VolTrainingResource = typeof volTrainingResourcesTable.$inferSelect;
export type VolWaiver = typeof volWaiversTable.$inferSelect;
