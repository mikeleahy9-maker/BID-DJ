import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getCreditPack, getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/checkout/credits
 *
 * Creates a Stripe Checkout session for a guest credit purchase, scoped to a
 * specific event.
 *
 * Body: { eventId: string, packId: string }
 *
 * Pricing is resolved SERVER-SIDE from CREDIT_PACKS; the client never sends an
 * amount. That keeps the charge and the granted credits trustworthy.
 *
 * The event, user and pack are mirrored into both `metadata` and
 * `payment_intent_data.metadata` so the webhook can credit the purchase from
 * whichever Stripe object arrives, even if the Checkout session is garbage
 * collected before the payment completes.
 *
 * No credits are granted here. The webhook grants them on
 * checkout.session.completed, which is the only place credits are created.
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
  try {
    const body = await req.json();
    eventId = String(body.eventId ?? "").trim();
    packId = String(body.packId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!eventId || !packId) {
    return NextResponse.json(
      { error: "eventId and packId are required." },
      { status: 400 }
    );
  }

  const pack = getCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 });
  }

  // The event must be live and the guest must have an attendee row for it,
  // otherwise credits would be granted against an event they never joined.
  let eventCode: string;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .select("id, code, status")
      .eq("id", eventId)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.status !== "live") {
      return NextResponse.json(
        { error: "Credits can only be bought for a live event." },
        { status: 409 }
      );
    }
    eventCode = data.code;
  } catch {
    return NextResponse.json(
      { error: "Could not load that event." },
      { status: 400 }
    );
  }

  const { data: attendee } = await getSupabaseAdmin()
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

  let customerEmail: string | undefined;
  try {
    const { data } = await getSupabaseAdmin()
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle();
    customerEmail = data?.email || undefined;
  } catch {
    customerEmail = undefined;
  }

  const appUrl = getAppUrl();
  const credits = String(pack.credits);
  const revenue = String(pack.revenueCents);
  const metadata = {
    type: "credit_purchase",
    userId: user.id,
    eventId,
    eventCode,
    packId: pack.id,
    credits,
    revenueCents: revenue,
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      customer_email: customerEmail,
      billing_address_collection: "auto",
      line_items: [
        {
          quantity: 1,
          // price_data (not a pre-created Price id) because packs are defined
          // in code. Amounts are integer cents, so no rounding concerns.
          price_data: {
            currency: "usd",
            unit_amount: pack.revenueCents,
            product_data: {
              name: `${pack.label} — BidaBeat`,
              description: `Credits for event ${eventCode}`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      // Returns to the live queue, where the attendees realtime subscription
      // picks up the new balance once the webhook lands. No reload needed.
      success_url: `${appUrl}/join/${encodeURIComponent(eventCode)}?purchased=1`,
      cancel_url: `${appUrl}/join/${encodeURIComponent(eventCode)}?purchased=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout credits] failed to create session:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
