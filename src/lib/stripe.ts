import Stripe from "stripe";
import { getStripeConfig } from "../config/env.js";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const config = getStripeConfig();
  if (!config) {
    throw new Error("Stripe is not configured");
  }

  stripeClient = new Stripe(config.secretKey);

  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return getStripeConfig() !== null;
}
