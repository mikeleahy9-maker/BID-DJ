import { NextRequest, NextResponse } from "next/server";
import { createDjConnectAccount, createDjOnboardingLink } from "@/lib/stripe-connect";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * POST /api/dj/connect
 *
 * Starts Stripe Connect onboarding for the signed-in DJ.
 *   - If the DJ has no Connect account yet, creates one and saves
 *     `stripe_connect_id` on dj_owner_profiles (reuse key for later events).
 *   - Creates an Account Link (`account_onboarding`) so the DJ lands inside
 *     Stripe's hosted onboarding to enter bank + identity details.
 *   - Returns `{ url }`; the client redirects the DJ there.
 *
 * Status is tracked on the Stripe side (recipient capability statuses) and
 * mirrored by the `v2.core.account[*]` webhooks. Never exposes the secret key:
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
      // The public slug is what makes the account's business URL point at the
      // DJ's real profile page instead of staying an open Stripe requirement.
      const { data: profile } = await supabase
        .from("profiles")
        .select("public_slug")
        .eq("id", user.id)
        .maybeSingle();

      connectId = await createDjConnectAccount({
        email: user.email,
        userId: user.id,
        publicSlug: profile?.public_slug ?? null,
      });

      // Upsert: first Connect setup, or a row created earlier without a key.
      const { error } = await supabase
        .from("dj_owner_profiles")
        .upsert(
          { user_id: user.id, stripe_connect_id: connectId },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    }

    const url = await createDjOnboardingLink(connectId);

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[connect] failed:", err);
    return NextResponse.json(
      { error: "Could not start Stripe onboarding. Please try again." },
      { status: 500 }
    );
  }
}