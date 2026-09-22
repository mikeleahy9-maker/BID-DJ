import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhooks (signed with STRIPE_WEBHOOK_SECRET).
 * Handled events:
 *   - checkout.session.completed (type = dj_activation_fee)
 *       → marks the DJ's one-time activation fee as paid.
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
          metadata?: { userId?: string; type?: string };
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