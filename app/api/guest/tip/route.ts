import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recordTip, resolveTipNickname, settleTip } from "@/lib/tips";

/**
 * POST /api/guest/tip
 *
 * Charges the guest's SAVED card for a tip to the DJ/Band, without leaving the
 * app. The whole tip belongs to the performer (no 70/20/10 split): the DJ
 * receives the amount minus Stripe's processing fee, paid out straight away.
 *
 * Body: { eventId: string, amountCents: number, message?: string, requestId: string }
 *
 * `requestId` is a client-generated id, reused across retries of the same
 * attempt and passed to Stripe as its idempotency key, so a double-click cannot
 * charge the guest twice. The amount is validated server-side and never trusted
 * blindly.
 *
 * Responses:
 *   200 { ok: true, tipId }              — paid; tip booked for payout
 *   200 { requiresAction, clientSecret } — bank needs 3-D Secure verification
 *   4xx/5xx { error }                    — declined, with a human message
 */

/** $1 floor; a $500 ceiling keeps a fat-fingered entry from charging a card. */
const MIN_TIP_CENTS = 100;
const MAX_TIP_CENTS = 50000;

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
  let requestId: string;
  let message: string;
  let amountCents: number;
  try {
    const body = await req.json();
    eventId = String(body.eventId ?? "").trim();
    requestId = String(body.requestId ?? "").trim();
    message = String(body.message ?? "").trim().slice(0, 140);
    amountCents = Math.round(Number(body.amountCents));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!eventId || !requestId) {
    return NextResponse.json(
      { error: "eventId and requestId are required." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(amountCents) || amountCents < MIN_TIP_CENTS) {
    return NextResponse.json(
      { error: "Minimum tip is $1.00." },
      { status: 400 }
    );
  }
  if (amountCents > MAX_TIP_CENTS) {
    return NextResponse.json(
      { error: "That tip is over the $500 limit." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: attendee } = await supabase
    .from("attendees")
    .select("id, nickname")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attendee) {
    return NextResponse.json(
      { error: "Join the event before tipping the DJ." },
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
      { error: "Tips can only be sent during a live event." },
      { status: 409 }
    );
  }

  // Load the saved card. Both fields are required: the PaymentIntent needs a
  // customer to attach the payment method to, and the payment method itself.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, stripe_customer_id, stripe_payment_method_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id || !profile?.stripe_payment_method_id) {
    return NextResponse.json(
      { error: "No saved card. Please add a card in your dashboard." },
      { status: 409 }
    );
  }

  const nickname = resolveTipNickname(attendee.nickname, profile.display_name, user.email);

  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: profile.stripe_customer_id,
        payment_method: profile.stripe_payment_method_id,
        // Charge immediately, off-session. The card is already on file, so no
        // interaction is expected unless the bank demands 3-D Secure.
        confirm: true,
        off_session: true,
        description: `DJ tip — BidaBeat (event ${event.code})`,
        metadata: {
          type: "guest_tip",
          userId: user.id,
          eventId,
          eventCode: event.code,
          amountCents: String(amountCents),
          nickname,
          message,
        },
      },
      // Prevents a double charge from a double-click or a retried request.
      { idempotencyKey: `guest_tip_${user.id}_${requestId}` }
    );

    if (intent.status === "succeeded") {
      const tip = await recordTip({
        eventId,
        userId: user.id,
        nickname,
        amountCents,
        message,
        paymentIntentId: intent.id,
      });
      await settleTip(tip.id);
      return NextResponse.json({ ok: true, tipId: tip.id });
    }

    if (intent.status === "requires_action") {
      // The bank wants verification. Hand the client secret back so the browser
      // can finish it with Stripe.js; nothing is booked until it succeeds.
      return NextResponse.json({
        requiresAction: true,
        clientSecret: intent.client_secret,
      });
    }

    if (intent.status === "requires_payment_method") {
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
    return NextResponse.json({ error: declineMessage(err) }, { status: 402 });
  }
}

/**
 * Turns a Stripe error into something a guest can act on.
 */
function declineMessage(err: unknown): string {
  const e = err as { type?: string; message?: string };
  if (e?.type === "StripeCardError" || e?.type === "StripeInvalidRequestError") {
    return e.message ?? "Your card was declined. Please try another card.";
  }
  console.error("[tip] payment failed:", err);
  return "We couldn't take that payment. Please try again.";
}
