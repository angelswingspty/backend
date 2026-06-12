import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { getStripeConfig } from "../config/env.js";
import type { Database } from "../db/index.js";
import {
  donationsTable,
  stripeWebhookEventsTable,
} from "../db/schema/donations.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";

type DbClient = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const checkoutBodySchema = z.object({
  amountCents: z.number().int().min(50).max(100_000_000),
  email: z.string().email(),
  name: z.string().trim().min(1).max(200).optional(),
});

const IDEMPOTENCY_HEADER = "idempotency-key";

async function findDonationByIdempotencyKey(
  db: DbClient,
  idempotencyKey: string,
) {
  const [donation] = await db
    .select()
    .from(donationsTable)
    .where(eq(donationsTable.idempotencyKey, idempotencyKey))
    .limit(1);

  return donation;
}

async function resumeCheckoutSession(
  stripe: Stripe,
  donation: typeof donationsTable.$inferSelect,
) {
  if (!donation.stripeCheckoutSessionId) {
    return null;
  }

  const session = await stripe.checkout.sessions.retrieve(
    donation.stripeCheckoutSessionId,
  );

  if (session.status === "complete") {
    return {
      status: "completed" as const,
      sessionId: session.id,
    };
  }

  if (session.status === "open" && session.url) {
    return {
      status: "open" as const,
      url: session.url,
      sessionId: session.id,
      reused: true,
    };
  }

  return null;
}

export const donationRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/donations/checkout-session",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({
          error: "Donations are not configured yet",
        });
      }

      const idempotencyKey = request.headers[IDEMPOTENCY_HEADER];
      if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
        return reply.status(400).send({
          error: `${IDEMPOTENCY_HEADER} header is required`,
        });
      }

      const parsed = checkoutBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid donation request",
          details: parsed.error.flatten(),
        });
      }

      const { amountCents, email, name } = parsed.data;
      const stripe = getStripe();
      const config = getStripeConfig()!;

      const existing = await findDonationByIdempotencyKey(
        app.db,
        idempotencyKey,
      );
      if (existing) {
        const resumed = await resumeCheckoutSession(stripe, existing);
        if (resumed?.status === "completed") {
          return reply.status(409).send({
            error: "This donation has already been completed",
            sessionId: resumed.sessionId,
          });
        }
        if (resumed?.status === "open") {
          return {
            url: resumed.url,
            sessionId: resumed.sessionId,
            reused: true,
          };
        }
      }

      const [donation] = await app.db
        .insert(donationsTable)
        .values({
          amountCents,
          donorEmail: email,
          donorName: name,
          idempotencyKey,
          status: "pending",
        })
        .onConflictDoNothing({ target: donationsTable.idempotencyKey })
        .returning();

      const record =
        donation ??
        (await findDonationByIdempotencyKey(app.db, idempotencyKey));

      if (!record) {
        return reply.status(500).send({ error: "Failed to create donation" });
      }

      if (record.stripeCheckoutSessionId) {
        const resumed = await resumeCheckoutSession(stripe, record);
        if (resumed?.status === "open") {
          return {
            url: resumed.url,
            sessionId: resumed.sessionId,
            reused: true,
          };
        }
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountCents,
                product_data: {
                  name: "GHRI Donation",
                  description: "Support global health equity programs",
                },
              },
            },
          ],
          metadata: {
            donationId: String(record.id),
            idempotencyKey,
            donorName: name ?? "",
          },
          success_url: `${config.frontendUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${config.frontendUrl}/donate/cancel`,
        },
        { idempotencyKey: `checkout-${idempotencyKey}` },
      );

      await app.db
        .update(donationsTable)
        .set({ stripeCheckoutSessionId: session.id })
        .where(eq(donationsTable.id, record.id));

      if (!session.url) {
        return reply.status(500).send({ error: "Failed to create checkout session" });
      }

      return {
        url: session.url,
        sessionId: session.id,
        reused: false,
      };
    },
  );

  await app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookApp.post("/donations/webhook", async (request, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({ error: "Stripe is not configured" });
      }

      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return reply.status(400).send({ error: "Missing stripe-signature header" });
      }

      const stripe = getStripe();
      const config = getStripeConfig()!;
      const rawBody = request.body as Buffer;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          config.webhookSecret,
        );
      } catch (error) {
        request.log.warn({ err: error }, "Invalid Stripe webhook signature");
        return reply.status(400).send({ error: "Invalid webhook signature" });
      }

      const [existingEvent] = await app.db
        .select()
        .from(stripeWebhookEventsTable)
        .where(eq(stripeWebhookEventsTable.stripeEventId, event.id))
        .limit(1);

      if (existingEvent) {
        return { received: true, duplicate: true };
      }

      try {
        const processed = await processStripeEvent(app.db, event);
        if (!processed) {
          return { received: true, duplicate: true };
        }
      } catch (error) {
        request.log.error({ err: error, eventId: event.id }, "Webhook processing failed");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }

      return { received: true, duplicate: false };
    });
  });
};

async function processStripeEvent(
  db: Database,
  event: Stripe.Event,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(stripeWebhookEventsTable)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
      })
      .onConflictDoNothing({ target: stripeWebhookEventsTable.stripeEventId })
      .returning();

    if (!inserted) {
      return false;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markDonationCompleted(tx, session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await tx
          .update(donationsTable)
          .set({ status: "expired" })
          .where(eq(donationsTable.stripeCheckoutSessionId, session.id));
        break;
      }
      default:
        break;
    }

    return true;
  });
}

async function markDonationCompleted(
  tx: DbClient,
  session: Stripe.Checkout.Session,
) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const updateData = {
    status: "completed" as const,
    stripePaymentIntentId: paymentIntentId ?? null,
    completedAt: new Date(),
  };

  const [updated] = await tx
    .update(donationsTable)
    .set(updateData)
    .where(eq(donationsTable.stripeCheckoutSessionId, session.id))
    .returning();

  if (updated) {
    return;
  }

  const donationId = session.metadata?.donationId;
  if (!donationId) {
    return;
  }

  await tx
    .update(donationsTable)
    .set({
      ...updateData,
      stripeCheckoutSessionId: session.id,
    })
    .where(eq(donationsTable.id, Number(donationId)));
}
