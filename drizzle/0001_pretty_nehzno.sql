CREATE TYPE "ghri_mock"."donation_status" AS ENUM('pending', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "ghri_mock"."donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"donor_email" text NOT NULL,
	"donor_name" text,
	"status" "ghri_mock"."donation_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghri_mock"."stripe_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "donations_idempotency_key_unique" ON "ghri_mock"."donations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_stripe_checkout_session_id_unique" ON "ghri_mock"."donations" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_stripe_payment_intent_id_unique" ON "ghri_mock"."donations" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_unique" ON "ghri_mock"."stripe_webhook_events" USING btree ("stripe_event_id");