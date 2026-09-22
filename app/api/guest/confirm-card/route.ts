import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * POST /api/guest/confirm-card
 * Body: { setupIntentId: string }
 * Response: { ok: true }
 *
 * The browser calls this right after stripe.confirmSetup() succeeds. Instead
 * of waiting for the async Stripe webhook, the card details are written to
 * profiles synchronously — so the (guest) layout's "card required" gate can
 * flip immediately after save (no timing race on refresh / re-login).
 *
 * The SetupIntent is re-fetched server-side and its metadata.user_id must match
 * the caller — the client's claims are never trusted. The webhook handler
 * performs the same update idempotently, so both paths converge.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let setupIntentId: string;
  try {
    const body = await req.json();
    setupIntentId = String(body.setupIntentId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!setupIntentId) {
    return NextResponse.json({ error: "Missing setup intent id." }, { status: 400 });
  }

  try {
    const intent = await getStripe().setupIntents.retrieve(setupIntentId);

    if (intent.metadata?.user_id !== user.id) {
      return NextResponse.json(
        { error: "This setup intent does not belong to your account." },
        { status: 403 }
      );
    }
    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Card wasn't saved yet. Please try again." },
        { status: 400 }
      );
    }

    const customerId =
      typeof intent.customer === "string" ? intent.customer : null;
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
        console.warn("[confirm-card] could not retrieve payment method:", err);
      }
    }

    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stripe_customer_id: customerId ?? undefined,
        stripe_payment_method_id: pmId ?? undefined,
        card_brand: card?.brand ?? null,
        card_last4: card?.last4 ?? null,
        card_exp_month: card?.exp_month ?? null,
        card_exp_year: card?.exp_year ?? null,
      })
      .eq("id", user.id);
    if (updateError) throw updateError;

    console.info(`[confirm-card] card saved for ${user.id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-card] failed:", err);
    return NextResponse.json(
      { error: "Could not save your card. Please try again." },
      { status: 500 }
    );
  }
}
