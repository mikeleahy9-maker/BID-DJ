import Stripe from "stripe";
import { getAppUrl } from "@/lib/app-url";

/**
 * Stripe server-side singleton and BidaBeat fee constants.
 * Server-only module — never import from a client component.
 */

/** Stripe Price ID for the one-time DJ activation fee ($50). */
export const DJ_ACTIVATION_PRICE_ID = "price_1UGzSwSNzy6FSWcqZUTv8Dkh";
export const DJ_ACTIVATION_FEE_LABEL = "BidaBeat DJ Activation";

/**
 * Credit packs sold to guests.
 *
 * Priced in CENTS and treated as server-authoritative: /api/checkout/credits
 * looks the pack up by id and ignores any amount sent by the client, so a
 * tampered request cannot change what is charged or how many credits land.
 *
 * `credits` includes bonus credits, so credits and revenue intentionally
 * diverge (a $20.00 pack grants 23 credits). Settlement must use
 * revenueCents -- never credits x $1 -- or BidaBeat would distribute money it
 * never collected. Keep the guest-facing copy in features/guest/data.ts in
 * sync; the server copy below is the one that decides the charge.
 */
export interface CreditPack {
  id: string;
  credits: number;
  revenueCents: number;
  label: string;
  badge?: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "pack_5", credits: 5, revenueCents: 500, label: "5 Credits" },
  { id: "pack_11", credits: 11, revenueCents: 1000, label: "11 Credits", badge: "POPULAR" },
  { id: "pack_23", credits: 23, revenueCents: 2000, label: "23 Credits", badge: "BEST VALUE" },
  { id: "pack_58", credits: 58, revenueCents: 5000, label: "58 Credits", badge: "HIGH ROLLER" },
] as const;

export function getCreditPack(packId: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === packId) ?? null;
}

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