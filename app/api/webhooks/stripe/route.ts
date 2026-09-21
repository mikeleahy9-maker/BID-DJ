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