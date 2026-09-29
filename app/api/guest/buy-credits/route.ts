import { NextRequest, NextResponse } from "next/server";
import { getCreditPack, getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/guest/buy-credits
 *
 * Charges the guest's SAVED card for a credit pack, without leaving the app.
 * Guests already save a card during signup, and the (guest) layout blocks every
 * guest page until one exists, so a card is always present here.
 *
 * Body: { eventId: string, packId: string, requestId: string }
 *
 * `requestId` is a client-generated id, reused across retries of the same
 * attempt and passed to Stripe as its idempotency key. Without it, a
 * double-click or a retried fetch would create two PaymentIntents and charge
 * the guest twice.
 *
 * Pricing is resolved server-side from CREDIT_PACKS. No amount is trusted from
 * the client.
 *
 * Responses:
 *   200 { ok: true }                     — paid; credits granted
 *   200 { requiresAction, clientSecret } — bank needs 3-D Secure verification
 *   4xx/5xx { error }                    — declined, with a human message
 */
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let eventId: string;
  let packId: string;
  let requestId: string;
  try {
    const body = await req.json();
    eventId = String(body.eventId ?? "").trim();
    packId = String(body.packId ?? "").trim();
    requestId = String(body.requestId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!eventId || !packId || !requestId) {
    return NextResponse.json(
      { error: "eventId, packId and requestId are required." },
      { status: 400 }
    );
  }

  const pack = getCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // The guest must already be an attendee of this event.
  const { data: attendee } = await supabase
    .from("attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attendee) {
    return NextResponse.json(
      { error: "Join the event before buying credits." },
      { status: 403 }
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, code, status")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.status !== "live") {
    return NextResponse.json(
      { error: "Credits can only be bought for a live event." },
      { status: 409 }
    );
  }

  // Load the saved card. Both fields are required: the PaymentIntent needs a
  // customer to attach the payment method to, and the payment method itself.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_payment_method_id, card_last4")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id || !profile?.stripe_payment_method_id) {
    return NextResponse.json(
      { error: "No saved card. Please add a card in your dashboard." },
      { status: 409 }
    );
  }

  const metadata = {
    type: "credit_purchase",
    userId: user.id,
    eventId,
    eventCode: event.code,
    packId: pack.id,
    credits: String(pack.credits),
    revenueCents: String(pack.revenueCents),
  };

  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: pack.revenueCents,
        currency: "usd",
        customer: profile.stripe_customer_id,
        payment_method: profile.stripe_payment_method_id,
        // Charge immediately, off-session. The card is already on file, so no
        // interaction is expected unless the bank demands 3-D Secure.
        confirm: true,
        off_session: true,
        description: `${pack.label} — BidaBeat (event ${event.code})`,
        metadata,
      },
      // Prevents a double charge from a double-click or a retried request.
      { idempotencyKey: `credit_purchase_${user.id}_${requestId}` }
    );

    if (intent.status === "succeeded") {
      const granted = await fulfill(user.id, eventId, intent.id, pack);
      return NextResponse.json({ ok: true, ...granted });
    }

    if (intent.status === "requires_action") {
      // The bank wants verification. Hand the client secret back so the browser
      // can finish it with Stripe.js; nothing is granted until it succeeds.
      return NextResponse.json({
        requiresAction: true,
        clientSecret: intent.client_secret,
      });
    }

    if (intent.status === "requires_payment_method") {
      // Card declined or no longer usable — force the guest to re-add one.
      return NextResponse.json(
        {
          error:
            "Your card was declined. Please remove it and add a new card in your dashboard.",
          cardDeclined: true,
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "That payment could not be completed. Please try again." },
      { status: 402 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: declineMessage(err) },
      { status: 402 }
    );
  }
}

/**
 * Records the sale and grants credits. The webhook does the same thing from
 * payment_intent.succeeded, and both are keyed on the PaymentIntent id, so the
 * second call is a no-op. Granting inline just means the guest sees their
 * balance immediately instead of waiting for the webhook round-trip.
 */
async function fulfill(
  userId: string,
  eventId: string,
  paymentIntentId: string,
  pack: { credits: number; revenueCents: number }
) {
  const { data, error } = await getSupabaseAdmin().rpc("record_credit_purchase", {
    p_event_id: eventId,
    p_user_id: userId,
    p_stripe_reference: paymentIntentId,
    p_stripe_payment_intent_id: paymentIntentId,
    p_credits_granted: pack.credits,
    p_revenue_cents: pack.revenueCents,
  });
  if (error) throw error;
  return { creditsGranted: data?.credits_granted ?? pack.credits };
}

/** Turns a Stripe error into something a guest can act on. */
function declineMessage(err: unknown): string {
  const e = err as {
    type?: string;
    code?: string;
    message?: string;
  };
  if (e?.type === "StripeCardError" || e?.type === "StripeInvalidRequestError") {
    return e.message ?? "Your card was declined. Please try another card.";
  }
  console.error("[buy-credits] payment failed:", err);
  return "We couldn't take that payment. Please try again.";
}
