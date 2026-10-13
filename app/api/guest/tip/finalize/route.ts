import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/supabase/server";
import { recordTip, resolveTipNickname, settleTip } from "@/lib/tips";

/**
 * POST /api/guest/tip/finalize
 *
 * Completes a tip that required 3-D Secure.
 *
 * The browser confirms the PaymentIntent with Stripe.js, which may show a bank
 * challenge. This endpoint then re-reads the intent server-side and, if it
 * actually succeeded, books the tip for payout.
 *
 * The intent is the authority, not the client: status and amount are read from
 * Stripe and the intent must belong to the caller, so a guest cannot claim a
 * payment succeeded (or under-report one) that did not.
 *
 * The webhook and the inline charge path both call record_tip on
 * payment_intent.succeeded, keyed on the same intent id, so a race between them
 * books the tip exactly once.
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
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);

    // Ownership check: the intent's metadata must name the caller. Without this,
    // any signed-in guest could finalize (and be credited for) someone else's
    // payment intent id.
    if (intent.metadata?.userId !== user.id) {
      return NextResponse.json(
        { error: "That payment does not belong to your account." },
        { status: 403 }
      );
    }

    if (intent.metadata?.type !== "guest_tip") {
      return NextResponse.json({ error: "Not a tip." }, { status: 400 });
    }

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        {
          error:
            intent.status === "processing"
              ? "Your bank is still processing this tip. It will be sent in a moment."
              : "That payment was not completed. You have not been charged.",
        },
        { status: 409 }
      );
    }

    const eventId = intent.metadata.eventId;
    if (!eventId || !intent.amount || intent.amount < 100) {
      return NextResponse.json(
        { error: "This tip is missing its details." },
        { status: 400 }
      );
    }

    // The intent's own recorded values are the source of truth; the amount is
    // what was actually charged, never a client-supplied figure.
    const nickname = resolveTipNickname(intent.metadata.nickname, undefined, user.email);
    const message = String(intent.metadata.message ?? "").slice(0, 140);

    const tip = await recordTip({
      eventId,
      userId: user.id,
      nickname,
      amountCents: intent.amount,
      message,
      paymentIntentId: intent.id,
    });
    await settleTip(tip.id);

    return NextResponse.json({ ok: true, tipId: tip.id });
  } catch (err) {
    console.error("[tip finalize] failed:", err);
    return NextResponse.json(
      { error: "Could not complete your tip. Please try again." },
      { status: 500 }
    );
  }
}
