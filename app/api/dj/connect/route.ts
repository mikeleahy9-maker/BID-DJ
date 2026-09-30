import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * POST /api/dj/connect
 *
 * Starts Stripe Connect (Express) onboarding for the signed-in DJ.
 *   - If the DJ has no Connect account yet, creates one and saves
 *     `stripe_connect_id` on dj_owner_profiles (reuse key for later events).
 *   - Creates an Account Link (`account_onboarding`) so the DJ lands inside
 *     Stripe's hosted onboarding to enter bank + identity details.
 *   - Returns `{ url }`; the client redirects the DJ there.
 *
 * Status is tracked on the Stripe side (`details_submitted`, `payouts_enabled`)
 * and mirrored by the `account.updated` webhook. Never exposes the secret key:
 * only the link url leaves this route.
 */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: owner } = await supabase
      .from("dj_owner_profiles")
      .select("stripe_connect_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let connectId = owner?.stripe_connect_id ?? null;

    if (!connectId) {
      const account = await getStripe().accounts.create({
        type: "express",
        country: "US",
        email: user.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        metadata: { role: "dj", user_id: user.id },
      });
      connectId = account.id;

      // Upsert: first Connect setup, or a row created earlier without a key.
      const { error } = await supabase
        .from("dj_owner_profiles")
        .upsert(
          { user_id: user.id, stripe_connect_id: connectId },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    }

    const link = await getStripe().accountLinks.create({
      account: connectId,
      refresh_url: `${getAppUrl()}/dj/connect?refresh=1`,
      return_url: `${getAppUrl()}/dj/events?connect=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("[connect] failed:", err);
    return NextResponse.json(
      { error: "Could not start Stripe onboarding. Please try again." },
      { status: 500 }
    );
  }
}