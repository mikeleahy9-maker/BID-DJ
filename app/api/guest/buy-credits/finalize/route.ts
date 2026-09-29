import { NextRequest, NextResponse } from "next/server";
import { getCreditPack, getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/guest/buy-credits/finalize
 *
 * Completes a purchase that required 3-D Secure.
 *
 * The browser confirms the PaymentIntent with Stripe.js, which may show a bank
 * challenge. This endpoint then re-reads the intent server-side and, if it
 * actually succeeded, records the sale and grants credits.
 *
 * The intent is the authority, not the client: the client cannot claim a
 * payment succeeded when it did not, because status is read from Stripe and
 * the intent must belong to the caller.
 *
 * The webhook also calls this grant path on payment_intent.succeeded, keyed on
 * the same PaymentIntent id, so a race between the two grants nothing twice.
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

  let paymentIntentId: string;
  try {
    const body = await req.json();
    paymentIntentId = String(body.paymentIntentId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "Missing payment intent id." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Ownership check: the intent's metadata must name the caller. Without
    // this, any signed-in guest could finalize (and be credited for) someone
    // else's payment intent id.
    if (intent.metadata?.userId !== user.id) {
      return NextResponse.json(
        { error: "That payment does not belong to your account." },
        { status: 403 }
      );
    }

    if (intent.metadata?.type !== "credit_purchase") {
      return NextResponse.json({ error: "Not a credit purchase." }, { status: 400 });
    }

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        {
          error:
            intent.status === "processing"
              ? "Your bank is still processing this payment. Credits will appear in a moment."
              : "That payment was not completed. You have not been charged.",
        },
        { status: 409 }
      );
    }

    // Amount and pack come from the server-side catalog and the intent's own
    // recorded metadata, never from the request body.
    const pack = getCreditPack(intent.metadata.packId ?? "");
    const eventId = intent.metadata.eventId;
    if (!pack || !eventId) {
      return NextResponse.json(
        { error: "This purchase is missing its pack details." },
        { status: 400 }
      );
    }

    // Guard against an under-priced intent: a mismatch means the amount and
    // the credits disagree, and granting on that would underpay for the
    // credits issued.
    if (intent.amount !== pack.revenueCents) {
      console.error(
        `[finalize] amount mismatch on ${paymentIntentId}: charged ${intent.amount}, pack is ${pack.revenueCents}`
      );
      return NextResponse.json(
        { error: "This purchase needs support. Please contact us." },
        { status: 500 }
      );
    }

    const { data, error } = await getSupabaseAdmin().rpc("record_credit_purchase", {
      p_event_id: eventId,
      p_user_id: user.id,
      p_stripe_reference: intent.id,
      p_stripe_payment_intent_id: intent.id,
      p_credits_granted: pack.credits,
      p_revenue_cents: pack.revenueCents,
    });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      creditsGranted: data?.credits_granted ?? pack.credits,
    });
  } catch (err) {
    console.error("[finalize] failed:", err);
    return NextResponse.json(
      { error: "Could not complete your purchase. Please try again." },
      { status: 500 }
    );
  }
}
