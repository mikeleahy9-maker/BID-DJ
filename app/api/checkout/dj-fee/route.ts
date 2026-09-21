import { NextRequest, NextResponse } from "next/server";
import { DJ_ACTIVATION_PRICE_ID, getAppUrl, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/checkout/dj-fee
 *
 * Creates a Stripe Checkout session for the one-time $50 DJ activation fee.
 * Body: { userId: string } — the auth user id from the signup form.
 * Response: { url } — Stripe-hosted checkout. The user is redirected there;
 * the webhook (checkout.session.completed) marks the fee as paid.
 */
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY missing)." },
      { status: 503 }
    );
  }

  let userId: string;
  try {
    const body = await req.json();
    userId = String(body.userId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });
  }

  let customerEmail: string | undefined;
  try {
    const { data } = await getSupabaseAdmin()
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    customerEmail = data?.email || undefined;
  } catch {
    // Non-fatal — checkout still works; the email field is just left empty.
    customerEmail = undefined;
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      // Pre-fills the email field on the hosted payment page.
      customer_email: customerEmail,
      // Don't ask for a billing address on the payment form.
      billing_address_collection: "auto",
      line_items: [
        {
          quantity: 1,
          price: DJ_ACTIVATION_PRICE_ID,
        },
      ],
      metadata: { userId, type: "dj_activation_fee" },
      success_url: `${getAppUrl()}/dj-login?activated=1`,
      cancel_url: `${getAppUrl()}/dj-signup?payment=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout dj-fee] failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}