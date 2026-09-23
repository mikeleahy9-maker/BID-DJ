import Stripe from "stripe";
import { getAppUrl } from "@/lib/app-url";

/**
 * Stripe server-side singleton and BidaBeat fee constants.
 * Server-only module — never import from a client component.
 */

/** Stripe Price ID for the one-time DJ activation fee ($50). */
export const DJ_ACTIVATION_PRICE_ID = "price_1UGzSwSNzy6FSWcqZUTv8Dkh";
export const DJ_ACTIVATION_FEE_LABEL = "BidaBeat DJ Activation";

/** Public app URL used to build Stripe redirect URLs (see lib/app-url). */
export { getAppUrl };

/** Lazy-initialized Stripe client. Throws if the secret key is not configured. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment or .env.local (see .env.example)."
    );
  }
  return new Stripe(key);
}

/** Server-only helper that returns null when Stripe is not yet configured. */
export function getStripeOrNull(): Stripe | null {
  return process.env.STRIPE_SECRET_KEY ? getStripe() : null;
}