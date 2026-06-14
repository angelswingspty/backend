CREATE TABLE "ghri_mock"."telehealth_email_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_users" ALTER COLUMN "mfa_enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "ghri_mock"."telehealth_email_otps" ADD CONSTRAINT "telehealth_email_otps_user_id_telehealth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ghri_mock"."telehealth_users"("id") ON DELETE cascade ON UPDATE no action;