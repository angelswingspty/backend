import {
    serial,
  text,
  timestamp,
  boolean,
  integer,
  } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";

export const telehealthRoleEnum = app.enum("telehealth_role", [
  "patient",
  "provider",
]);
export const appointmentStatusEnum = app.enum("appointment_status", [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);
export const appointmentTypeEnum = app.enum("appointment_type", [
  "video",
  "phone",
  "follow_up",
]);
export const documentTypeEnum = app.enum("document_type", [
  "lab_result",
  "imaging",
  "referral",
  "insurance",
  "consent",
  "other",
]);
export const prescriptionStatusEnum = app.enum("prescription_status", [
  "active",
  "completed",
  "cancelled",
]);

export const telehealthUsersTable = app.table("telehealth_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: telehealthRoleEnum("role").notNull(),
  name: text("name").notNull(),
  specialty: text("specialty"),
  phone: text("phone"),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaBackupCodes: text("mfa_backup_codes"),
  consentedAt: timestamp("consented_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telehealthSessionsTable = app.table("telehealth_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => telehealthUsersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appointmentsTable = app.table("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  providerId: integer("provider_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  type: appointmentTypeEnum("type").default("video").notNull(),
  notes: text("notes"),
  videoRoomUrl: text("video_room_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telehealthMessagesTable = app.table("telehealth_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  recipientId: integer("recipient_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  contentEncrypted: text("content_encrypted").notNull(),
  nonce: text("nonce").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medicalDocumentsTable = app.table("medical_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  uploadedById: integer("uploaded_by_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  filename: text("filename").notNull(),
  documentType: documentTypeEnum("document_type").default("other").notNull(),
  storageKey: text("storage_key").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prescriptionsTable = app.table("prescriptions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  providerId: integer("provider_id")
    .notNull()
    .references(() => telehealthUsersTable.id),
  medication: text("medication").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency").notNull(),
  instructions: text("instructions"),
  refills: integer("refills").default(0).notNull(),
  status: prescriptionStatusEnum("status").default("active").notNull(),
  prescribedAt: timestamp("prescribed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consentRecordsTable = app.table("consent_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => telehealthUsersTable.id, { onDelete: "cascade" }),
  formType: text("form_type").notNull(),
  consented: boolean("consented").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsTable = app.table("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => telehealthUsersTable.id),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TelehealthUser = typeof telehealthUsersTable.$inferSelect;
export type InsertTelehealthUser = typeof telehealthUsersTable.$inferInsert;
export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;
export type TelehealthMessage = typeof telehealthMessagesTable.$inferSelect;
export type Prescription = typeof prescriptionsTable.$inferSelect;
export type MedicalDocument = typeof medicalDocumentsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
