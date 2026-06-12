CREATE SCHEMA IF NOT EXISTS "ghri_mock";
--> statement-breakpoint
CREATE TYPE "ghri_mock"."appointment_status" AS ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "ghri_mock"."appointment_type" AS ENUM('video', 'phone', 'follow_up');--> statement-breakpoint
CREATE TYPE "ghri_mock"."document_type" AS ENUM('lab_result', 'imaging', 'referral', 'insurance', 'consent', 'other');--> statement-breakpoint
CREATE TYPE "ghri_mock"."prescription_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "ghri_mock"."telehealth_role" AS ENUM('patient', 'provider');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_event_status" AS ENUM('upcoming', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_hour_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_reg_status" AS ENUM('registered', 'attended', 'cancelled');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_resource_type" AS ENUM('video', 'document', 'quiz', 'article');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_role" AS ENUM('volunteer', 'coordinator');--> statement-breakpoint
CREATE TYPE "ghri_mock"."vol_status" AS ENUM('pending', 'active', 'inactive');--> statement-breakpoint
CREATE TABLE "ghri_mock"."contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"profession" text NOT NULL,
	"interest_area" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."newsletters" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "newsletters_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"category" text NOT NULL,
	"slug" text NOT NULL,
	"image_url" text,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" "ghri_mock"."appointment_status" DEFAULT 'scheduled' NOT NULL,
	"type" "ghri_mock"."appointment_type" DEFAULT 'video' NOT NULL,
	"notes" text,
	"video_room_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"ip_address" text,
	"user_agent" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"form_type" text NOT NULL,
	"consented" boolean NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."medical_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"uploaded_by_id" integer NOT NULL,
	"filename" text NOT NULL,
	"document_type" "ghri_mock"."document_type" DEFAULT 'other' NOT NULL,
	"storage_key" text NOT NULL,
	"file_size_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"medication" text NOT NULL,
	"dosage" text NOT NULL,
	"frequency" text NOT NULL,
	"instructions" text,
	"refills" integer DEFAULT 0 NOT NULL,
	"status" "ghri_mock"."prescription_status" DEFAULT 'active' NOT NULL,
	"prescribed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."telehealth_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"content_encrypted" text NOT NULL,
	"nonce" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."telehealth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"last_active" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telehealth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."telehealth_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "ghri_mock"."telehealth_role" NOT NULL,
	"name" text NOT NULL,
	"specialty" text,
	"phone" text,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_backup_codes" text,
	"consented_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telehealth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."patient_intake_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"medical_history_enc" text,
	"medical_history_nonce" text,
	"allergies_enc" text,
	"allergies_nonce" text,
	"medications_enc" text,
	"medications_nonce" text,
	"insurance_enc" text,
	"insurance_nonce" text,
	"blood_type" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patient_intake_forms_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_event_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"volunteer_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"status" "ghri_mock"."vol_reg_status" DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"max_volunteers" integer,
	"coordinator_id" integer,
	"status" "ghri_mock"."vol_event_status" DEFAULT 'upcoming' NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_service_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"volunteer_id" integer NOT NULL,
	"event_id" integer,
	"description" text NOT NULL,
	"hours" real NOT NULL,
	"service_date" timestamp NOT NULL,
	"status" "ghri_mock"."vol_hour_status" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_active" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vol_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_training_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"volunteer_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"score" integer
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_training_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"resource_type" "ghri_mock"."vol_resource_type" DEFAULT 'document' NOT NULL,
	"url" text,
	"duration_minutes" integer,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "ghri_mock"."vol_role" DEFAULT 'volunteer' NOT NULL,
	"status" "ghri_mock"."vol_status" DEFAULT 'pending' NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"skills" text,
	"availability" text,
	"bio" text,
	"avatar_initials" text,
	"consented_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vol_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_waiver_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"volunteer_id" integer NOT NULL,
	"waiver_id" integer NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"signature_data" text
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."vol_waivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghri_mock"."appointments" ADD CONSTRAINT "appointments_patient_id_telehealth_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."appointments" ADD CONSTRAINT "appointments_provider_id_telehealth_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_telehealth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."consent_records" ADD CONSTRAINT "consent_records_user_id_telehealth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."medical_documents" ADD CONSTRAINT "medical_documents_patient_id_telehealth_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."medical_documents" ADD CONSTRAINT "medical_documents_uploaded_by_id_telehealth_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."prescriptions" ADD CONSTRAINT "prescriptions_patient_id_telehealth_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."prescriptions" ADD CONSTRAINT "prescriptions_provider_id_telehealth_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_messages" ADD CONSTRAINT "telehealth_messages_sender_id_telehealth_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_messages" ADD CONSTRAINT "telehealth_messages_recipient_id_telehealth_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_sessions" ADD CONSTRAINT "telehealth_sessions_user_id_telehealth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."patient_intake_forms" ADD CONSTRAINT "patient_intake_forms_patient_id_telehealth_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_event_registrations" ADD CONSTRAINT "vol_event_registrations_volunteer_id_vol_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_event_registrations" ADD CONSTRAINT "vol_event_registrations_event_id_vol_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "ghri_mock"."vol_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_events" ADD CONSTRAINT "vol_events_coordinator_id_vol_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_messages" ADD CONSTRAINT "vol_messages_sender_id_vol_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_messages" ADD CONSTRAINT "vol_messages_recipient_id_vol_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_service_hours" ADD CONSTRAINT "vol_service_hours_volunteer_id_vol_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_sessions" ADD CONSTRAINT "vol_sessions_user_id_vol_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_training_progress" ADD CONSTRAINT "vol_training_progress_volunteer_id_vol_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_training_progress" ADD CONSTRAINT "vol_training_progress_resource_id_vol_training_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "ghri_mock"."vol_training_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_waiver_signatures" ADD CONSTRAINT "vol_waiver_signatures_volunteer_id_vol_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "ghri_mock"."vol_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_waiver_signatures" ADD CONSTRAINT "vol_waiver_signatures_waiver_id_vol_waivers_id_fk" FOREIGN KEY ("waiver_id") REFERENCES "ghri_mock"."vol_waivers"("id") ON DELETE cascade ON UPDATE no action;