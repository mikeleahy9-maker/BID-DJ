import {
  fetchDjConnectAccountStatus,
  connectStatusFromAccount,
  type DjConnectAccountStatus,
} from "@/lib/stripe-connect";
import { getStripeOrNull } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Current Stripe Connect status for a DJ owner account.
 *
 * The account id lives on `dj_owner_profiles.stripe_connect_id` and the mirrored
 * onboarding state lives next to it (`connect_status` / `connect_onboarded_at`),
 * but Stripe remains the source of truth: every read re-queries the live
 * capability status and reconciles the row, so the column can never drift far.
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
    .select("stripe_connect_id, connect_status, connect_onboarded_at")
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
    const status = await fetchDjConnectAccountStatus(connectId);
    await mirrorConnectStatus(supabase, userId, owner, status);
    return {
      connectId,
      hasAccount: true,
      detailsSubmitted: status.detailsSubmitted,
      payoutsEnabled: status.payoutsEnabled,
      connected: status.connected,
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

/**
 * Reconciles the mirrored columns with the live Stripe status.
 *
 * Best-effort: a failed write is logged, not thrown, because the caller only
 * needed the live status it already has. Written only when something would
 * actually change, so a steady-state read does not churn the row. `suspended`
 * is intentionally not derived here -- only an account-closed webhook can tell
 * a closed account from one that is merely mid-onboarding.
 */
async function mirrorConnectStatus(
  supabase: SupabaseClient,
  userId: string,
  owner: { connect_status?: string | null; connect_onboarded_at?: string | null } | null,
  status: DjConnectAccountStatus
): Promise<void> {
  // Never clear a closure: a read cannot tell a closed account from one that is
  // merely mid-onboarding (both look "not connected"), so only the account
  // webhook may leave 'suspended'.
  if (owner?.connect_status === "suspended") return;

  const nextStatus = connectStatusFromAccount(status);
  const needsOnboardedAt = nextStatus === "onboarded" && !owner?.connect_onboarded_at;
  if (owner?.connect_status === nextStatus && !needsOnboardedAt) return;

  const now = new Date().toISOString();
  const onboardedAt =
    nextStatus === "onboarded"
      ? (owner?.connect_onboarded_at ?? now)
      : (owner?.connect_onboarded_at ?? null);

  const { error } = await supabase
    .from("dj_owner_profiles")
    .update({
      connect_status: nextStatus,
      connect_onboarded_at: onboardedAt,
      connect_updated_at: now,
    })
    .eq("user_id", userId);
  if (error) {
    console.warn("[connect-status] could not mirror the status:", error);
  }
}
