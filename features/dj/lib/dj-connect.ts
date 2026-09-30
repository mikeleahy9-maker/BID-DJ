import { getStripeOrNull } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Current Stripe Connect status for a DJ owner account.
 * The connect id is stored on dj_owner_profiles (reuse key); truth about
 * onboarding lives on Stripe's side, so status is queried live rather than
 * cached in a column.
 */
export async function getDjConnectStatus(userId: string): Promise<{
  connectId: string | null;
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  connected: boolean;
}> {
  const supabase = getSupabaseAdmin();
  const { data: owner } = await supabase
    .from("dj_owner_profiles")
    .select("stripe_connect_id")
    .eq("user_id", userId)
    .maybeSingle();

  const connectId = owner?.stripe_connect_id ?? null;
  if (!connectId) {
    return {
      connectId,
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      connected: false,
    };
  }

  const stripe = getStripeOrNull();
  if (!stripe) {
    return {
      connectId,
      hasAccount: true,
      detailsSubmitted: false,
      payoutsEnabled: false,
      connected: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(connectId);
    const detailsSubmitted = Boolean(account.details_submitted);
    const payoutsEnabled =
      Boolean(account.details_submitted) && Boolean(account.payouts_enabled);
    return {
      connectId,
      hasAccount: true,
      detailsSubmitted,
      payoutsEnabled,
      connected: detailsSubmitted && payoutsEnabled,
    };
  } catch (err) {
    console.error(`[connect-status] account ${connectId} retrieval failed:`, err);
    return {
      connectId,
      hasAccount: true,
      detailsSubmitted: false,
      payoutsEnabled: false,
      connected: false,
    };
  }
}