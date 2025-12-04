import Stripe from "stripe";

function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
    typescript: true,
  });
}

// Lazy initialization to avoid build errors
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = createStripeClient();
  }
  return _stripe;
}

// For backward compatibility
export const stripe = {
  get customers() { return getStripe().customers; },
  get checkout() { return getStripe().checkout; },
  get subscriptions() { return getStripe().subscriptions; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
};

export const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY || "",
  pro_yearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY || "",
};
