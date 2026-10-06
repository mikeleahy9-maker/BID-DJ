import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/dj/stripe/session
 *
 * Creates an Account Session with embedded components for the DJ's
 * connected Stripe account. Returns the client_secret for the frontend
 * to initialize the embedded components.
 */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: owner } = await supabase
    .from("dj_owner_profiles")
    .select("stripe_connect_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const connectId = owner?.stripe_connect_id ?? null;
  if (!connectId) {
    return NextResponse.json(
      { error: "No connected Stripe account found." },
      { status: 404 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.accountSessions.create({
      account: connectId,
      components: {
        balances: {
          enabled: true,
          features: {
            standard_payouts: true,
            edit_payout_schedule: true,
            external_account_collection: true,
          },
        },
        payouts_list: { enabled: true },
      },
    });

    return NextResponse.json({ client_secret: session.client_secret });
  } catch (err) {
    console.error("[stripe/session] failed:", err);
    return NextResponse.json(
      { error: "Could not create Stripe session." },
      { status: 500 }
    );
  }
}