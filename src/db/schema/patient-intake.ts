import { serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";
import { telehealthUsersTable } from "./telehealth.js";

export const patientIntakeFormsTable = app.table("patient_intake_forms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .unique()
    .references(() => telehealthUsersTable.id, { onDelete: "cascade" }),

  // AES-256-GCM encrypted JSON blobs + nonces
  medicalHistoryEnc: text("medical_history_enc"),
  medicalHistoryNonce: text("medical_history_nonce"),

  allergiesEnc: text("allergies_enc"),
  allergiesNonce: text("allergies_nonce"),

  medicationsEnc: text("medications_enc"),
  medicationsNonce: text("medications_nonce"),

  insuranceEnc: text("insurance_enc"),
  insuranceNonce: text("insurance_nonce"),

  // Non-PHI plain fields
  bloodType: text("blood_type"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),

  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PatientIntakeForm = typeof patientIntakeFormsTable.$inferSelect;
