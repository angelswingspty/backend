import { integer, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { app } from "./namespace.js";

export const donationStatusEnum = app.enum("donation_status", [
  "pending",
  "completed",
  "failed",
  "expired",
]);

export const donationsTable = app.table(
  "donations",
  {
    id: serial("id").primaryKey(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("usd").notNull(),
    donorEmail: text("donor_email").notNull(),
    donorName: text("donor_name"),
    status: donationStatusEnum("status").default("pending").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("donations_idempotency_key_unique").on(table.idempotencyKey),
    uniqueIndex("donations_stripe_checkout_session_id_unique").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("donations_stripe_payment_intent_id_unique").on(
      table.stripePaymentIntentId,
    ),
  ],
);

export const stripeWebhookEventsTable = app.table(
  "stripe_webhook_events",
  {
    id: serial("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_stripe_event_id_unique").on(
      table.stripeEventId,
    ),
  ],
);

export type Donation = typeof donationsTable.$inferSelect;
export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;
