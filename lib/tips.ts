import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeOrNull } from "@/lib/stripe";
import { fetchDjConnectAccountStatus } from "@/lib/stripe-connect";
import {
  availableUsdCents,
  describeError,
  isInsufficientFunds,
  readChargeFee,
} from "@/lib/settlement";

/**
 * Guest tips → the DJ/Band.
 *
 * A tip is a plain platform charge whose whole value belongs to the performer.
 * The DJ receives the tip MINUS Stripe's processing fee -- there is no 70/20/10
 * split -- and it is paid out immediately, one transfer per tip.
 *
 * The money model mirrors a single settlement leg (see lib/settlement.ts): the
 * charge lands in OUR Stripe balance, so the transfer can only go out once the
 * charge settles into `available` and the DJ's connected account can receive it.
 * A tip that cannot be paid yet is `held` and picked up by retryOutstandingTips
 * on the same triggers the event sweep uses (cron, balance.available, account
 * webhooks) -- no tip is ever lost to a slow bank.
 *
 * Status vocabulary:
 *   pending  booked, not paid out yet (funds still settling / first attempt)
 *   held     Stripe did not send it: not funded yet, or recipient not ready
 *   sent     the transfer exists, or there was nothing left after the fee
 *   failed   Stripe rejected it for a reason that needs a person
 */

const CURRENCY = "usd";

/**
 * Stripe replays a recorded idempotency outcome for 24 hours. A `pending` tip
 * with an attempt already recorded cannot be told apart from one whose transfer
 * may have gone out, so past this window it is not auto-retried.
 */
const IDEMPOTENCY_WINDOW_MS = 25 * 60 * 60 * 1000;

type TipStatus = "pending" | "held" | "sent" | "failed";

const TIP_SELECT =
  "id, event_id, dj_id, amount_cents, fee_cents, stripe_payment_intent_id, status, attempt, updated_at";

interface TipPayout {
  id: string;
  event_id: string;
  dj_id: string | null;
  amount_cents: number;
  fee_cents: number;
  stripe_payment_intent_id: string | null;
  status: TipStatus;
  attempt: number;
  updated_at: string;
}

type StripeClient = NonNullable<ReturnType<typeof getStripeOrNull>>;

/** The DJ's payout account, if they have finished (or started) onboarding. */
async function getDjConnectId(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("dj_owner_profiles")
    .select("stripe_connect_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_connect_id ?? null;
}

/** Recipient readiness, without letting a Stripe lookup abort a payout. */
async function recipientReady(accountId: string | null): Promise<{
  ready: boolean;
  reason: string | null;
}> {
  if (!accountId) {
    return { ready: false, reason: "The DJ has not connected a Stripe account yet." };
  }
  try {
    const status = await fetchDjConnectAccountStatus(accountId);
    if (status.transfersEnabled) return { ready: true, reason: null };
    return {
      ready: false,
      reason: status.payoutsEnabled
        ? "The DJ's account cannot receive transfers yet."
        : "The DJ's Stripe onboarding is not complete.",
    };
  } catch (err) {
    return {
      ready: false,
      reason: err instanceof Error ? err.message : "Could not check the DJ's account.",
    };
  }
}

/** The tip's value after Stripe's fee, floored at zero. */
export function netTipCents(tip: {
  amount_cents: number;
  fee_cents: number;
}): number {
  return Math.max(0, Number(tip.amount_cents) - Number(tip.fee_cents));
}

/**
 * Books a paid tip exactly once per PaymentIntent.
 *
 * The inline charge path and the payment_intent.succeeded webhook both call
 * this, keyed on the intent id, so whichever arrives second inserts nothing.
 */
export async function recordTip(input: {
  eventId: string;
  userId: string;
  nickname: string;
  amountCents: number;
  message: string;
  paymentIntentId: string;
}): Promise<{ id: string }> {
  const { data, error } = await getSupabaseAdmin().rpc("record_tip", {
    p_event_id: input.eventId,
    p_user_id: input.userId,
    p_nickname: input.nickname,
    p_amount_cents: input.amountCents,
    p_message: input.message,
    p_stripe_payment_intent_id: input.paymentIntentId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (!row?.id) throw new Error("Tip was charged but could not be recorded.");
  return { id: row.id };
}

/** The name the DJ sees: the guest's event nickname, else their display name. */
export function resolveTipNickname(
  attendeeNickname: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const nick = attendeeNickname?.trim();
  if (nick) return nick;
  const display = displayName?.trim();
  if (display) return display;
  const local = email?.split("@")[0]?.trim();
  return local || "A guest";
}

/**
 * Reads Stripe's processing fee onto the tip and returns it.
 *
 * `fee_cents = 0` is the "not read yet" marker (no real charge has a zero fee).
 * Returns null when the fee is not available yet -- a charge that was just
 * confirmed has no balance transaction for a few seconds, and settling on an
 * unread fee would transfer the whole tip to the DJ and overdraw the platform.
 */
async function ensureFee(
  admin: ReturnType<typeof getSupabaseAdmin>,
  stripe: StripeClient,
  tip: TipPayout
): Promise<number | null> {
  if (tip.fee_cents > 0) return tip.fee_cents;
  if (!tip.stripe_payment_intent_id) return 0;

  try {
    const fee = await readChargeFee(stripe, tip.stripe_payment_intent_id);
    const { error } = await admin
      .from("tips")
      .update({ fee_cents: fee, updated_at: new Date().toISOString() })
      .eq("id", tip.id);
    if (error) throw error;
    return fee;
  } catch (err) {
    console.info(`[tips] fee for ${tip.id} is not ready yet:`, err);
    return null;
  }
}

async function markHeld(
  admin: ReturnType<typeof getSupabaseAdmin>,
  tipId: string,
  reason: string | null
): Promise<void> {
  await admin
    .from("tips")
    .update({
      status: "held",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tipId);
}

/**
 * Pays a single tip out to the DJ.
 *
 * Idempotent: the attempt counter is persisted before the transfer is created
 * and only advances once an outcome is stored, and the idempotency key is scoped
 * to the tip and the attempt -- so re-running an unfinished tip returns the
 * transfer Stripe already made instead of creating a second one.
 */
export async function settleTip(tipId: string): Promise<{ status: TipStatus }> {
  const admin = getSupabaseAdmin();
  const stripe = getStripeOrNull();
  if (!stripe) return { status: "held" };

  const { data, error } = await admin
    .from("tips")
    .select(TIP_SELECT)
    .eq("id", tipId)
    .maybeSingle();
  if (error || !data) return { status: "held" };

  const tip = data as TipPayout;
  // Terminal states are done: `sent` paid (or had nothing to pay), `failed`
  // needs a person and must never be replayed automatically.
  if (tip.status === "sent" || tip.status === "failed") {
    return { status: tip.status };
  }

  const fee = await ensureFee(admin, stripe, tip);
  if (fee === null) {
    await markHeld(admin, tip.id, "Waiting for Stripe to finalize the processing fee.");
    return { status: "held" };
  }

  const net = netTipCents({ amount_cents: tip.amount_cents, fee_cents: fee });
  if (net <= 0) {
    // The fee consumed the whole tip (a very small tip); there is nothing to
    // transfer, so this is settled, not held.
    await admin
      .from("tips")
      .update({ status: "sent", failure_reason: null, updated_at: new Date().toISOString() })
      .eq("id", tip.id);
    return { status: "sent" };
  }

  const destination = tip.dj_id ? await getDjConnectId(tip.dj_id) : null;
  const ready = await recipientReady(destination);
  if (!ready.ready || !destination) {
    // Stripe was never called, so the attempt counter does not move: this is a
    // hold we can retry freely once the DJ finishes onboarding.
    await markHeld(admin, tip.id, ready.reason);
    return { status: "held" };
  }

  const attempt = tip.attempt + 1;
  if (tip.status === "pending" && tip.attempt > 0) {
    const lastTouch = Date.parse(tip.updated_at);
    if (Number.isFinite(lastTouch) && Date.now() - lastTouch > IDEMPOTENCY_WINDOW_MS) {
      await admin
        .from("tips")
        .update({
          status: "failed",
          failure_reason:
            "This tip has an interrupted transfer attempt that is outside Stripe's " +
            "24-hour dedupe window. Reconcile it in the Stripe dashboard before retrying.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tip.id);
      return { status: "failed" };
    }
  }

  // Record the attempt BEFORE calling Stripe: the only evidence a transfer may
  // have gone out if this process dies mid-call.
  const { error: attemptError } = await admin
    .from("tips")
    .update({ attempt, updated_at: new Date().toISOString() })
    .eq("id", tip.id);
  if (attemptError) {
    console.error(`[tips] could not record attempt ${attempt} for ${tip.id}:`, attemptError);
    return { status: tip.status };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: net,
        currency: CURRENCY,
        destination,
        description: `Tip — BidaBeat (event ${tip.event_id})`,
        metadata: { kind: "guest_tip", tip_id: tip.id, event_id: tip.event_id },
      },
      { idempotencyKey: `tip:${tip.id}:${attempt}` }
    );
    await admin
      .from("tips")
      .update({
        status: "sent",
        stripe_transfer_id: transfer.id,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tip.id);
    return { status: "sent" };
  } catch (err) {
    const retryable = isInsufficientFunds(err);
    const status: TipStatus = retryable ? "held" : "failed";
    await admin
      .from("tips")
      .update({
        status,
        failure_reason: describeError(err),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tip.id);
    return { status };
  }
}

/**
 * Pays out every tip that is waiting on settled platform funds or the DJ's
 * onboarding.
 *
 * The single ordering engine for tip money, triggered by the same events as
 * event settlements: the scheduled /api/cron/settle sweep, `balance.available`
 * (charges moved out of pending) and the Account v2 webhooks (the DJ just
 * became payable). Tips are processed oldest-first (FIFO).
 *
 * `failed` tips are left alone -- those are Stripe rejections a person has to
 * look at, and replaying them automatically is how a payment gets made twice.
 * Returns how many tips were paid out.
 */
export async function retryOutstandingTips(): Promise<number> {
  const admin = getSupabaseAdmin();
  const stripe = getStripeOrNull();
  if (!stripe) return 0;

  const { data, error } = await admin
    .from("tips")
    .select(TIP_SELECT)
    .in("status", ["pending", "held"])
    .order("created_at", { ascending: true });
  if (error || !data?.length) return 0;

  // Read any unread fee first so the outstanding total below is real: a tip
  // whose fee is still 0 would overstate what is owed and could hold a run back.
  for (const tip of data as TipPayout[]) {
    if (tip.fee_cents === 0 && tip.stripe_payment_intent_id) {
      await ensureFee(admin, stripe, tip);
    }
  }

  const refreshed = await admin
    .from("tips")
    .select(TIP_SELECT)
    .in("status", ["pending", "held"])
    .order("created_at", { ascending: true });
  const rows = (refreshed.data ?? []) as TipPayout[];
  if (rows.length === 0) return 0;

  const outstanding = rows.reduce((sum, tip) => sum + netTipCents(tip), 0);
  if (outstanding <= 0) {
    // Every tip is smaller than its own fee; settle them so they stop showing
    // up as outstanding.
    for (const tip of rows) await settleTip(tip.id);
    return 0;
  }

  // `balance.available` fires on changes we cannot spend against; only attempt
  // transfers once the balance actually covers what is owed.
  const available = await availableUsdCents(stripe);
  if (available === null || available < outstanding) {
    console.info(
      `[tips] balance not ready yet: ${available ?? "?"}c available, ` +
        `${outstanding}c across ${rows.length} tip(s)`
    );
    return 0;
  }

  let released = 0;
  for (const tip of rows) {
    const outcome = await settleTip(tip.id);
    if (outcome.status === "sent") released += 1;
  }
  if (released > 0) console.info(`[tips] released ${released} tip(s)`);
  return released;
}
