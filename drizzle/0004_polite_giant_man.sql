ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "profile_picture_url" text;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "notify_appointments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "notify_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "notify_security" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_users" ADD COLUMN "profile_picture_url" text;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_users" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_users" ADD COLUMN "notify_events" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ghri_mock"."vol_users" ADD COLUMN "notify_messages" boolean DEFAULT true NOT NULL;