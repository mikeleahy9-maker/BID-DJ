import { NextRequest, NextResponse } from "next/server";
import { getCreditPack, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhooks (signed with STRIPE_WEBHOOK_SECRET).
 * Handled events:
 *   - checkout.session.completed (type = dj_activation_fee)
 *       → marks the DJ's one-time activation fee as paid.
 *   - checkout.session.completed (type = credit_purchase)
 *       → records a hosted-Checkout credit purchase.
 *   - payment_intent.succeeded (type = credit_purchase)
 *       → records an off-session credit purchase against the guest's saved
 *         card. This is the normal path, since guests save a card at signup.
 *   - payment_intent.payment_failed / .canceled (type = credit_purchase)
 *       → acknowledged; nothing is granted on failure.
 *   - setup_intent.succeeded (metadata.user_id)
 *       → saves the guest's Stripe customer + payment method refs on profiles.
 *   - setup_intent.canceled
 *       → acknowledged; the profile keeps any previously saved card.
 *
 * handlers are idempotent: updates are keyed by stable PKs / event values, so
 * a replayed event converges to the same state and any credit ledger writes
 * are protected by unique stripe-intent indexes.
 */

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhook secret is not set." }, { status: 503 });
  }

  let event;
  try {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
    }
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[webhook stripe] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
          payment_intent?: string | StripePaymentIntentRef;
        };
        const metadata = session.metadata ?? {};
        if (metadata.type === "dj_activation_fee" && metadata.userId) {
          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : null;

          const supabase = getSupabaseAdmin();
          const { error } = await supabase.rpc("mark_dj_fee_paid", {
            p_user_id: metadata.userId,
            p_intent_id: paymentIntentId ?? "",
          });
          if (error) throw error;
          console.info(`[webhook stripe] DJ activated: ${metadata.userId}`);
        }

        if (metadata.type === "credit_purchase") {
          await fulfillCreditPurchase(event.id, event.data.object as never);
        }
        break;
      }
      case "payment_intent.succeeded": {
        // The off-session path: charging the guest's saved card never goes
        // through Checkout, so the session handler above never fires for it.
        // Keyed on the PaymentIntent id, so a purchase that also produced a
        // session event is recorded exactly once.
        const intent = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
        };
        if (intent.metadata?.type === "credit_purchase") {
          await fulfillCreditPurchase(intent.id, intent);
        }
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        // Nothing is granted on failure, so this only needs acknowledging.
        const intent = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
        };
        if (intent.metadata?.type === "credit_purchase") {
          console.info(
            `[webhook stripe] credit purchase ${intent.id} did not complete: ${event.type}`
          );
        }
        break;
      }
      case "setup_intent.succeeded": {
        const intent = event.data.object as {
          id: string;
          customer?: string | null;
          payment_method?: string | { id: string } | null;
          metadata?: { user_id?: string };
        };
        const userId = intent.metadata?.user_id;
        if (!userId) {
          console.warn("[webhook stripe] setup_intent.succeeded without metadata.user_id; ignoring.");
          break;
        }

        const customerId = typeof intent.customer === "string" ? intent.customer : null;
        const pmId =
          typeof intent.payment_method === "string"
            ? intent.payment_method
            : intent.payment_method?.id ?? null;

        // Only display metadata (brand / last4 / expiry) — never raw card data.
        let card: {
          brand?: string | null;
          last4?: string | null;
          exp_month?: number | null;
          exp_year?: number | null;
        } | null = null;
        if (pmId) {
          try {
            const pm = await getStripe().paymentMethods.retrieve(pmId);
            card = pm.card ?? null;
          } catch (err) {
            console.warn("[webhook stripe] could not retrieve payment method:", err);
          }
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId ?? undefined,
            stripe_payment_method_id: pmId ?? undefined,
            card_brand: card?.brand ?? null,
            card_last4: card?.last4 ?? null,
            card_exp_month: card?.exp_month ?? null,
            card_exp_year: card?.exp_year ?? null,
          })
          .eq("id", userId);
        if (error) throw error;
        console.info(`[webhook stripe] card saved for ${userId}`);
        break;
      }
      case "setup_intent.canceled": {
        console.info(
          `[webhook stripe] setup_intent canceled: ${(event.data.object as { id: string }).id}`
        );
        break;
      }
      default:
        // Unhandled events are acknowledged quietly.
        break;
    }
  } catch (err) {
    console.error("[webhook stripe] handler failed:", err);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type StripePaymentIntentRef = { id: string };

/**
 * Grants purchased credits and records the financial ledger row.
 *
 * Credits and revenue are stored in separate columns and must not be conflated:
 * a $20.00 pack grants 23 credits, but only $20.00 was collected, so the
 * 70/20/10 split must later be computed from revenue_cents alone.
 *
 * The grant is delegated to record_credit_purchase(), keyed on the Stripe
 * reference. Every path that can report a successful purchase -- the Checkout
 * session, the PaymentIntent, the client's finalize call -- passes the same
 * PaymentIntent id, and only the first is recorded. Stripe retries webhook
 * deliveries, and this is what stands between a retry and double-crediting.
 */
async function fulfillCreditPurchase(
  stripeReference: string,
  source: {
    id: string;
    metadata?: Record<string, string | undefined>;
    payment_intent?: string | StripePaymentIntentRef;
  }
): Promise<void> {
  const metadata = source.metadata ?? {};
  const userId = metadata.userId;
  const packId = metadata.packId;
  const eventId = metadata.eventId;

  if (!userId || !packId || !eventId) {
    console.error(
      `[webhook stripe] credit_purchase ${source.id} missing userId/packId/eventId; ignoring.`
    );
    return;
  }

  // Price from the server-side catalog, not from metadata. Metadata is written
  // by our own server, but trusting it would let a tampered session decide how
  // many credits a payment is worth.
  const pack = getCreditPack(packId);
  if (!pack) {
    console.error(
      `[webhook stripe] credit_purchase ${source.id} has unknown packId ${packId}; ignoring.`
    );
    return;
  }

  // Always key on the PaymentIntent, even for Checkout sessions, so the two
  // webhook paths cannot each record the same sale.
  const paymentIntentId =
    typeof source.payment_intent === "string"
      ? source.payment_intent
      : source.id.startsWith("pi_")
        ? source.id
        : null;

  const reference = paymentIntentId ?? source.id;

  const { data, error } = await getSupabaseAdmin().rpc("record_credit_purchase", {
    p_event_id: eventId,
    p_user_id: userId,
    p_stripe_reference: reference,
    p_stripe_payment_intent_id: paymentIntentId,
    p_credits_granted: pack.credits,
    p_revenue_cents: pack.revenueCents,
  });

  if (error) throw error;
  console.info(
    `[webhook stripe] recorded ${reference}: ${data?.credits_granted ?? pack.credits} credits ` +
      `(${data?.revenue_cents ?? pack.revenueCents}c) for ${userId} on event ${eventId}`
  );
}