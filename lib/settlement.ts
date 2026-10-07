import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeOrNull } from "@/lib/stripe";
import { fetchDjConnectAccountStatus } from "@/lib/stripe-connect";

/**
 * Event settlement: the moment a DJ ends a live gig.
 *
 * Credit purchases are plain platform charges (no destination / on_behalf_of /
 * transfer_data), so the revenue lands in OUR Stripe balance. Closing a night
 * only BOOKS the settlement -- it never moves money at close time, because the
 * charges are still sitting in Stripe's `pending` balance and a transfer
 * against them would be rejected. Money moves later, by a scheduled sweep
 * (Supabase pg_cron -> POST /api/cron/settle, plus the balance.available
 * webhook), once the charges have settled into `available`:
 *
 *   organizer_rate (default 70%) -> organizer's connected account
 *   payout_rate     (default 20%) -> DJ's connected account
 *   remainder                  -> platform keeps it
 *
 * The percentages come from event_finance(), never from the client. It splits
 * NET, not gross: Stripe takes its processing fee off each charge before the
 * money ever reaches our available balance. The fee for every purchase is read
 * from its balance_transaction first (see ensureStripeFees), then each party's
 * GROSS share and their proportional slice of the fees are stored separately,
 * so the DJ and organizer can see exactly what was deducted.
 *
 * Three properties this is built around:
 *
 *  1. Settle once. The settlement row is UNIQUE on event_id, so a second
 *     end-event loses an insert instead of booking twice.
 *  2. Book close, move later. /end creates the settlement and ends the event;
 *     the sweeper sends shares and is itself idempotent (scoped idempotency
 *     keys), so a missed or doubled run cannot pay anyone twice.
 *  3. Hold, don't block. A recipient who hasn't finished onboarding, or a
 *     balance that hasn't settled, leaves that share held/pending and the
 *     event still closes. An absent organizer must never stop the DJ from
 *     closing their own night.
 *
 * A leg's status records what is KNOWN about the money:
 *
 *   pending  not sent yet: either it was never attempted (just booked, or
 *            waiting on funds), or an attempt started and its outcome was
 *            never stored. attempt > 0 is the ambiguous case, restricted to
 *            Stripe's 24h dedupe window.
 *   held     Stripe did not send this money: either it was never called, or it
 *            called and definitively rejected the transfer (no funds / recipient
 *            not ready). Either way a later retry with a fresh key is safe.
 *   failed   Stripe rejected it for a reason that needs a human to look.
 *   sent     the transfer exists, or there was nothing to send.
 */

const CURRENCY = "usd";

/**
 * Stripe replays a recorded idempotency outcome for 24 hours. Once a leg has
 * started an attempt whose result was never stored, we can no longer tell
 * "died before Stripe saw it" from "died after Stripe accepted it", so past
 * this window we refuse to auto-retry rather than risk paying twice.
 */
const IDEMPOTENCY_WINDOW_MS = 25 * 60 * 60 * 1000;

export type LegStatus = "pending" | "held" | "sent" | "failed";

export interface SettlementSummary {
  settlementId: string;
  status: "in_progress" | "settled" | "partial";
  totalRevenueCents: number;
  totalFeesCents: number;
  netRevenueCents: number;
  organizerCents: number;
  organizerGrossCents: number;
  organizerFeeCents: number;
  djCents: number;
  djGrossCents: number;
  djFeeCents: number;
  platformCents: number;
  organizerRate: number;
  djRate: number;
  platformRate: number;
  organizer: { status: LegStatus; failureReason?: string | null };
  dj: { status: LegStatus; failureReason?: string | null };
  alreadySettled: boolean;
}

export type SettlementResult =
  | { ok: true; summary: SettlementSummary }
  | { ok: false; httpStatus: number; error: string };

interface FinanceRow {
  organization_id: string | null;
  organization_stripe_account_id: string | null;
  dj_rate: number;
  organizer_rate: number;
  platform_rate: number;
  total_revenue_cents: number;
  total_fees_cents: number;
  net_revenue_cents: number;
  organizer_cents: number;
  organizer_gross_cents: number;
  organizer_fee_cents: number;
  dj_cents: number;
  dj_gross_cents: number;
  dj_fee_cents: number;
  platform_cents: number;
}

interface SettlementRow {
  id: string;
  event_id: string;
  dj_id: string;
  status: "in_progress" | "settled" | "partial";
  total_revenue_cents: number;
  stripe_fees_cents: number;
  net_revenue_cents: number;
  organizer_cents: number;
  organizer_gross_cents: number;
  organizer_fee_cents: number;
  dj_cents: number;
  dj_gross_cents: number;
  dj_fee_cents: number;
  platform_cents: number;
  organizer_rate: number;
  dj_rate: number;
  platform_rate: number;
  organization_id: string | null;
  organization_stripe_account_id: string | null;
  organizer_status: LegStatus;
  organizer_attempt: number;
  organizer_failure_reason: string | null;
  dj_status: LegStatus;
  dj_attempt: number;
  dj_failure_reason: string | null;
  updated_at: string;
}

interface LegState {
  status: LegStatus;
  attempt: number;
  failureReason: string | null;
}

interface EventRow {
  id: string;
  dj_id: string;
  status: string;
  name: string;
  organization_id: string | null;
}

const SETTLEMENT_SELECT = `
  id, event_id, dj_id, status, total_revenue_cents, stripe_fees_cents,
  net_revenue_cents, organizer_cents, organizer_gross_cents, organizer_fee_cents,
  dj_cents, dj_gross_cents, dj_fee_cents, platform_cents, organizer_rate,
  dj_rate, platform_rate, organization_id, organization_stripe_account_id,
  organizer_status,
  organizer_attempt, organizer_failure_reason, dj_status, dj_attempt,
  dj_failure_reason, updated_at`;

/** Reads readiness without letting a Stripe lookup abort the whole close. */
async function recipientReady(accountId: string | null): Promise<{
  ready: boolean;
  reason: string | null;
}> {
  if (!accountId) {
    return { ready: false, reason: "No connected Stripe account." };
  }
  try {
    const status = await fetchDjConnectAccountStatus(accountId);
    // stripe_transfers is the receiving-side capability for a destination.
    if (status.transfersEnabled) return { ready: true, reason: null };
    return {
      ready: false,
      reason: status.payoutsEnabled
        ? "Account cannot receive transfers yet."
        : "Stripe onboarding is not complete.",
    };
  } catch (err) {
    return {
      ready: false,
      reason: err instanceof Error ? err.message : "Could not check the account.",
    };
  }
}

/**
 * Stripe's answer when it turned a transfer down.
 *
 * `retryable` marks a rejection that is safe to send again later with a fresh
 * idempotency key: Stripe refused before creating anything, so there is no
 * transfer that could be duplicated. Not-enough-money is the one that occurs
 * routinely, because charges land in `pending` and only move to `available` on
 * their balance_transaction's available_on date.
 */
type TransferOutcome =
  | { transferId: string }
  | { failureReason: string; retryable: boolean };

/**
 * "We don't have the money yet" as Stripe words it across its variants.
 * Matched on the message rather than a code: insufficient-funds rejections
 * from transfers.create arrive as an invalid_request_error with no stable
 * `code`, only this message.
 */
function isInsufficientFunds(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /insufficient available funds|insufficient funds|exceeds your available balance/i.test(
    message
  );
}

function describeError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { type?: string; code?: string; message?: string };
    const detail = [e.type, e.code].filter(Boolean).join("/");
    if (detail && e.message) return `${e.message} (${detail})`;
    if (e.message) return e.message;
  }
  return err instanceof Error ? err.message : "Transfer failed.";
}

async function transferTo({
  eventId,
  leg,
  amountCents,
  destination,
  attempt,
  description,
}: {
  eventId: string;
  leg: "dj" | "organizer";
  amountCents: number;
  destination: string;
  attempt: number;
  description: string;
}): Promise<TransferOutcome> {
  const stripe = getStripeOrNull();
  if (!stripe) {
    return { failureReason: "Stripe is not configured.", retryable: false };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: CURRENCY,
        destination,
        description,
        metadata: { event_id: eventId, leg },
      },
      // Scoped per leg and per attempt. Because `attempt` is persisted before
      // the call and only advances once an outcome is stored, re-running an
      // unfinished leg reuses the same key and Stripe returns the transfer it
      // already made instead of creating a second one.
      { idempotencyKey: `settle:${eventId}:${leg}:${attempt}` }
    );
    return { transferId: transfer.id };
  } catch (err) {
    return {
      failureReason: describeError(err),
      retryable: isInsufficientFunds(err),
    };
  }
}

/**
 * Stripe's processing fee for the charge behind a PaymentIntent, in cents.
 *
 * The fee lives on the charge's balance_transaction, which is only reachable
 * through the PaymentIntent. Nested expand gets it in one call rather than
 * three. The path differs by API version, so both are requested and the first
 * that actually came back expanded (an object, not a bare id string) is used:
 *   - latest_charge.balance_transaction    (API version >= 2022-08-02)
 *   - charges.data.balance_transaction     (legacy versions)
 * A PaymentIntent below `latest_charge` while the charges list still carries
 * the objects, which is why the fallback exists.
 */
export async function readChargeFee(
  stripe: StripeClient,
  paymentIntentId: string
): Promise<number> {
  const intent = (await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction", "charges.data.balance_transaction"],
  })) as {
    latest_charge?: unknown;
    charges?: { data?: { balance_transaction?: unknown }[] };
  };

  // The fee might be missing right after a charge is confirmed, before Stripe
  // has produced its balance transaction. Throwing tells the caller to retry
  // later; a real, settled charge always has one.
  const balanceTransaction = (() => {
    const latest = intent.latest_charge as
      | { balance_transaction?: unknown }
      | string
      | null
      | undefined;
    if (
      latest &&
      typeof latest === "object" &&
      latest.balance_transaction &&
      typeof latest.balance_transaction !== "string"
    ) {
      return latest.balance_transaction;
    }
    const bt = intent.charges?.data?.[0]?.balance_transaction;
    return bt && typeof bt !== "string" ? bt : null;
  })();

  const fee = (balanceTransaction as { fee?: unknown } | null)?.fee;
  if (typeof fee !== "number") {
    throw new Error(`no fee recorded for ${paymentIntentId}`);
  }
  return fee;
}

/**
 * Reads Stripe's processing fee onto every purchase of this event that does
 * not have one yet.
 *
 * This runs before event_finance() so the split is computed from real numbers:
 * a purchase whose fee is still 0 would inflate the net and could ask Stripe
 * for more than the balance holds. It therefore fails loudly rather than
 * settling on fees it never read -- the settlement is safe to retry, splitting
 * on unknown fees is not.
 *
 * `fee_cents = 0` is the marker for "not read yet" because no real Stripe
 * charge has a zero fee, so a row drops out of this query on success. Rows
 * with no PaymentIntent (manually seeded) never match and are never fetched.
 */
export async function ensureStripeFees(
  admin: SupabaseClient,
  eventId: string
): Promise<void> {
  const stripe = getStripeOrNull();
  if (!stripe) throw new Error("Stripe is not configured.");

  const { data: pending, error } = await admin
    .from("credit_purchases")
    .select("id, stripe_payment_intent_id")
    .eq("event_id", eventId)
    .eq("fee_cents", 0)
    .not("stripe_payment_intent_id", "is", null);

  if (error) {
    throw new Error("Could not read this event's card processing fees. Please retry.");
  }
  const rows = (pending ?? []) as { id: string; stripe_payment_intent_id: string }[];
  if (rows.length === 0) return;

  for (const row of rows) {
    let fee: number;
    try {
      fee = await readChargeFee(stripe, row.stripe_payment_intent_id);
    } catch (err) {
      console.error(
        `[settlement] could not read the fee for purchase ${row.id} (${row.stripe_payment_intent_id}):`,
        err
      );
      throw new Error(
        "Could not verify the card processing fees for this event. Please retry."
      );
    }

    const { error: updateError } = await admin
      .from("credit_purchases")
      .update({ fee_cents: fee })
      .eq("id", row.id);
    if (updateError) {
      throw new Error("Could not record the card processing fees. Please retry.");
    }
  }

  console.info(`[settlement] read fees for ${rows.length} purchase(s) on ${eventId}`);
}

export async function settleEvent(
  eventId: string,
  actorId: string
): Promise<SettlementResult> {
  // The DJ session is what grants event_finance(): it reads auth.uid(), so the
  // admin client would return an empty result and silently settle at $0.
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, dj_id, status, name, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return { ok: false, httpStatus: 500, error: "Could not load the event." };
  }
  if (!event) {
    return { ok: false, httpStatus: 404, error: "Event not found." };
  }
  if (event.dj_id !== actorId) {
    return { ok: false, httpStatus: 403, error: "Only the event owner can end it." };
  }

  const existing = await loadSettlement(admin, eventId);
  if (existing) {
    return resumeExisting({ admin, supabase, event, existing });
  }

  if (event.status !== "live") {
    return {
      ok: false,
      httpStatus: 409,
      error: `This event is ${event.status}, so it can't be settled.`,
    };
  }

  // Fees first: event_finance() splits net-of-fees, and it cannot know what it
  // has not been told. A lookup failure aborts here rather than settling on a
  // number that overstates what will ever be available.
  try {
    await ensureStripeFees(admin, eventId);
  } catch (err) {
    return {
      ok: false,
      httpStatus: 502,
      error: err instanceof Error ? err.message : "Could not total this event.",
    };
  }

  const { data: financeRows, error: financeError } = await supabase.rpc(
    "event_finance",
    { p_event_id: eventId }
  );

  if (financeError || !financeRows?.length) {
    return { ok: false, httpStatus: 500, error: "Could not total this event." };
  }
  const finance = financeRows[0] as FinanceRow;

  // Nothing is moved at close: the charges are still in Stripe's pending
  // balance, so a transfer now would be rejected. The row below is the full
  // booking -- amounts, fees, shares -- and the scheduled sweep transfers the
  // shares once the money settles into `available`.
  //
  // A share of zero counts as sent, so a free gig closes as 'settled' instead
  // of parking an eternal pending row. Otherwise a leg starts out 'pending'
  // (booked, not yet attempted; safe for the sweep to pick up).
  const zeroLegs = freshLegs();
  if (finance.organizer_cents <= 0) zeroLegs.organizer.status = "sent";
  if (finance.dj_cents <= 0) zeroLegs.dj.status = "sent";
  const bookedStatus =
    zeroLegs.organizer.status === "sent" && zeroLegs.dj.status === "sent"
      ? "settled"
      : "in_progress";

  // Unique on event_id: a concurrent end-event loses the race here instead of
  // in Stripe. The loser reads back whatever the winner has recorded and stops.
  const { data: inserted, error: insertError } = await admin
    .from("event_settlements")
    .insert({
      event_id: eventId,
      dj_id: event.dj_id,
      organization_id: finance.organization_id,
      organization_stripe_account_id: finance.organization_stripe_account_id,
      status: bookedStatus,
      organizer_status: zeroLegs.organizer.status,
      dj_status: zeroLegs.dj.status,
      total_revenue_cents: finance.total_revenue_cents,
      stripe_fees_cents: finance.total_fees_cents,
      net_revenue_cents: finance.net_revenue_cents,
      dj_rate: finance.dj_rate,
      organizer_rate: finance.organizer_rate,
      platform_rate: finance.platform_rate,
      organizer_cents: finance.organizer_cents,
      organizer_gross_cents: finance.organizer_gross_cents,
      organizer_fee_cents: finance.organizer_fee_cents,
      dj_cents: finance.dj_cents,
      dj_gross_cents: finance.dj_gross_cents,
      dj_fee_cents: finance.dj_fee_cents,
      platform_cents: finance.platform_cents,
    })
    .select(SETTLEMENT_SELECT)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const raced = await loadSettlement(admin, eventId);
      if (raced) return { ok: true, summary: toSummary(raced, true) };
    }
    return { ok: false, httpStatus: 500, error: "Could not record the settlement." };
  }

  const insertedRow = inserted as SettlementRow;

  if (event.status !== "ended") {
    const closeError = await closeEvent(supabase, event.id);
    if (closeError) {
      // The booking is on record; the DJ can re-run /end and resumeExisting()
      // will finish the close. Never report a closed night while it is live.
      console.error("[settlement] booking recorded but close failed:", closeError);
      return {
        ok: false,
        httpStatus: 500,
        error:
          "The settlement was recorded, but the event could not be closed. Please retry.",
      };
    }
  }

  return { ok: true, summary: toSummary(insertedRow, false) };
}

/**
 * A settlement row already exists -- a re-run of /end. The booking is kept
 * exactly as it was, the event is ensured closed, and the scheduled sweep
 * (touching only pending/held legs) moves the money. Re-running can never
 * re-book, re-split, or pay: that is what makes a retried close safe.
 */
async function resumeExisting({
  admin,
  supabase,
  event,
  existing,
}: {
  admin: SupabaseClient;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  event: EventRow;
  existing: SettlementRow;
}): Promise<SettlementResult> {
  // Recommendation of the amounts (and any unbooked fees) from before the
  // net-revenue migration. Transfers are NOT attempted here: /end has one job,
  // closing the night; the scheduled sweep moves the money.
  const row = await healLegacySplit({ admin, supabase, event, existing });

  // Make sure the event itself landed on ended, since a prior run may have
  // recorded the settlement and then died before closing.
  if (event.status !== "ended") {
    const closeError = await closeEvent(supabase, event.id);
    if (closeError) {
      return {
        ok: false,
        httpStatus: 500,
        error:
          "This settlement was recorded, but the event could not be closed. Please retry.",
      };
    }
  }
  return { ok: true, summary: toSummary(row, true) };
}

/**
 * Re-splits a settlement recorded before the net-revenue migration.
 *
 * Those rows carry gross amounts (organizer + dj + platform = what was charged,
 * before Stripe fees) and default fees/net of zero. When nothing has moved yet,
 * the amounts are rewritten onto the net basis so the sweep pays out the
 * correct, pay-able promises. Rows recorded after the net migration but before
 * the per-party fee columns have correct nets but empty gross/fee breakdowns;
 * those are backfilled from the stored values alone. A leg already recorded as
 * sent is left alone: that money is gone on the old basis, and re-splitting
 * would silently change a debt that was already paid.
 *
 * Returns the row the caller should keep using (healed copy or the original).
 */
async function healLegacySplit({
  admin,
  supabase,
  event,
  existing,
}: {
  admin: SupabaseClient;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  event: EventRow;
  existing: SettlementRow;
}): Promise<SettlementRow> {
  if (
    existing.total_revenue_cents <= 0 ||
    existing.organizer_status === "sent" ||
    existing.dj_status === "sent"
  ) {
    return existing;
  }

  // Net rows: only the per-party gross/fee breakdown is missing. It follows
  // from what we already store -- each net cut plus that cut's share of the
  // total fees -- so no fee re-read or event_finance() (and its DJ session)
  // is required.
  if (existing.net_revenue_cents > 0) {
    if (existing.organizer_gross_cents > 0 && existing.dj_gross_cents > 0) {
      return existing;
    }
    const organizerGross =
      existing.organizer_cents + feeShare(existing.organizer_rate, existing.stripe_fees_cents);
    const djGross =
      existing.dj_cents + feeShare(existing.dj_rate, existing.stripe_fees_cents);

    const healed: SettlementRow = {
      ...existing,
      organizer_gross_cents: organizerGross,
      organizer_fee_cents: Math.max(0, organizerGross - existing.organizer_cents),
      dj_gross_cents: djGross,
      dj_fee_cents: Math.max(0, djGross - existing.dj_cents),
    };

    const { error: updateError } = await admin
      .from("event_settlements")
      .update({
        organizer_gross_cents: organizerGross,
        organizer_fee_cents: healed.organizer_fee_cents,
        dj_gross_cents: djGross,
        dj_fee_cents: healed.dj_fee_cents,
      })
      .eq("id", existing.id);
    if (updateError) return existing;
    return healed;
  }

  // Fully legacy gross-basis row: re-read the fees and re-split onto net.
  // Best-effort: the event is already effectively closed, so a fee lookup
  // failure is not worth derailing the retry -- it merely keeps the old basis.
  try {
    await ensureStripeFees(admin, event.id);
  } catch {
    return existing;
  }

  const { data: financeRows, error } = await supabase.rpc("event_finance", {
    p_event_id: event.id,
  });
  if (error || !financeRows?.length) return existing;
  const finance = financeRows[0] as FinanceRow;

  const healed: SettlementRow = {
    ...existing,
    stripe_fees_cents: finance.total_fees_cents,
    net_revenue_cents: finance.net_revenue_cents,
    organizer_cents: finance.organizer_cents,
    organizer_gross_cents: finance.organizer_gross_cents,
    organizer_fee_cents: finance.organizer_fee_cents,
    dj_cents: finance.dj_cents,
    dj_gross_cents: finance.dj_gross_cents,
    dj_fee_cents: finance.dj_fee_cents,
    platform_cents: finance.platform_cents,
  };

  const { error: updateError } = await admin
    .from("event_settlements")
    .update({
      stripe_fees_cents: finance.total_fees_cents,
      net_revenue_cents: finance.net_revenue_cents,
      organizer_cents: finance.organizer_cents,
      organizer_gross_cents: finance.organizer_gross_cents,
      organizer_fee_cents: finance.organizer_fee_cents,
      dj_cents: finance.dj_cents,
      dj_gross_cents: finance.dj_gross_cents,
      dj_fee_cents: finance.dj_fee_cents,
      platform_cents: finance.platform_cents,
    })
    .eq("id", existing.id);
  if (updateError) return existing;

  console.info(
    `[settlement] re-split ${existing.event_id} onto net: ` +
      `${finance.organizer_cents + finance.dj_cents + finance.platform_cents}c ` +
      `(from ${existing.total_revenue_cents}c gross)`
  );
  return healed;
}

/**
 * The proportional slice of a total fee for one cut: floor(rate * total), the
 * same rounding event_finance() applies per party, so the displayed breakdown
 * matches what the sweep pays.
 */
function feeShare(rate: number, totalFeesCents: number): number {
  return Math.floor(rate * totalFeesCents);
}

/**
 * Sends whatever is still owed, records the outcomes, writes the DJ payout row
 * and flips the event to ended. Safe to call against a row that a previous
 * attempt left half-finished.
 *
 * `onlyRetryPendingOrHeld` hard-gates the legs: a leg recorded as `failed` is
 * Stripe's answer on record and a person has to look at it. Replaying it from
 * an automated trigger would issue a fresh idempotency key each run, which is
 * exactly how a transfer that really did go out (but reported a timeout) ends
 * up being paid twice. Close-time and sweep runs always gate; only the DJ's
 * own retry (an explicit re-run of /end... which no longer distributes) and
 * the account-update webhook may assume intent.
 */
async function distribute({
  admin,
  supabase,
  event,
  settlementId,
  finance,
  djAccountId,
  current,
  updatedAt,
  onlyRetryPendingOrHeld = true,
}: {
  admin: SupabaseClient;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  event: EventRow;
  settlementId: string;
  finance: FinanceRow;
  djAccountId: string | null;
  current: { organizer: LegState; dj: LegState };
  updatedAt: string;
  onlyRetryPendingOrHeld?: boolean;
}): Promise<SettlementResult> {
  const legs = await executeLegs({
    admin,
    settlementId,
    eventId: event.id,
    eventName: event.name,
    djAccountId,
    organizer: {
      cents: finance.organizer_cents,
      destination: finance.organization_stripe_account_id,
    },
    dj: { cents: finance.dj_cents, destination: djAccountId },
    current,
    updatedAt,
    onlyRetryPendingOrHeld,
  });

  if (legs.error) {
    return { ok: false, httpStatus: 500, error: legs.error };
  }

  await writePayout(admin, event.id, event.dj_id, finance.dj_cents, legs.dj);

  // Skipped when the night is already closed. Automated retries have no DJ
  // session, so RLS would reject the update -- and there is nothing to close.
  if (event.status !== "ended") {
    const closeError = await closeEvent(supabase, event.id);
    if (closeError) {
      console.error("[settlement] could not close the event:", closeError);
      return {
        ok: false,
        httpStatus: 500,
        error: "Money was distributed but the event could not be closed. Please retry.",
      };
    }
  }

  // Re-read: the outcomes written by executeLegs are the source of truth, and
  // this also covers a resume where a concurrent request wrote first.
  const row = await loadSettlement(admin, event.id);
  if (row) return { ok: true, summary: toSummary(row, false) };

  return {
    ok: false,
    httpStatus: 500,
    error: "The settlement could not be read back. Please retry.",
  };
}

const freshLegs = (): { organizer: LegState; dj: LegState } => ({
  organizer: { status: "pending", attempt: 0, failureReason: null },
  dj: { status: "pending", attempt: 0, failureReason: null },
});

/**
 * Sends a share that was held only because its recipient had not finished
 * Stripe onboarding, now that `accountId` has reported an update.
 *
 * Only 'held' legs qualify. A leg recorded as 'failed' already has Stripe's
 * answer on record and needs a person to look at it: re-running it from an
 * automated trigger would issue a fresh idempotency key on every account
 * update, which is exactly how a transfer that really did go out but reported
 * a timeout ends up being sent twice.
 *
 * Returns how many legs actually went out.
 */
export async function releaseHeldShares(accountId: string): Promise<number> {
  const admin = getSupabaseAdmin();

  const jobs: { row: SettlementRow; leg: "organizer" | "dj" }[] = [];

  const { data: orgRows } = await admin
    .from("event_settlements")
    .select(SETTLEMENT_SELECT)
    .eq("organization_stripe_account_id", accountId)
    .eq("organizer_status", "held");
  for (const row of (orgRows ?? []) as SettlementRow[]) {
    jobs.push({ row, leg: "organizer" });
  }

  const { data: owners } = await admin
    .from("dj_owner_profiles")
    .select("user_id")
    .eq("stripe_connect_id", accountId);
  const djIds = (owners ?? []).map((o) => (o as { user_id: string }).user_id);

  if (djIds.length > 0) {
    const { data: djRows } = await admin
      .from("event_settlements")
      .select(SETTLEMENT_SELECT)
      .in("dj_id", djIds)
      .eq("dj_status", "held");
    for (const row of (djRows ?? []) as SettlementRow[]) {
      jobs.push({ row, leg: "dj" });
    }
  }

  if (jobs.length === 0) return 0;

  const names = await loadEventNames(
    admin,
    jobs.map((job) => job.row.event_id)
  );
  let released = 0;

  for (const job of jobs) {
    const legs = await executeLegs({
      admin,
      settlementId: job.row.id,
      eventId: job.row.event_id,
      eventName: names.get(job.row.event_id) ?? "event",
      djAccountId: job.leg === "dj" ? accountId : null,
      organizer: {
        cents: job.row.organizer_cents,
        destination: job.row.organization_stripe_account_id,
      },
      dj: { cents: job.row.dj_cents, destination: job.leg === "dj" ? accountId : null },
      current: {
        organizer: {
          status: job.row.organizer_status,
          attempt: job.row.organizer_attempt,
          failureReason: job.row.organizer_failure_reason,
        },
        dj: {
          status: job.row.dj_status,
          attempt: job.row.dj_attempt,
          failureReason: job.row.dj_failure_reason,
        },
      },
      updatedAt: job.row.updated_at,
      only: job.leg,
    });

    if (legs.error) {
      console.error(
        `[settlement] could not release the held ${job.leg} share on ${job.row.event_id}: ${legs.error}`
      );
      continue;
    }

    if (job.leg === "dj") {
      await writePayout(admin, job.row.event_id, job.row.dj_id, job.row.dj_cents, legs.dj);
    }
    if ((job.leg === "dj" ? legs.dj.status : legs.organizer.status) === "sent") {
      released += 1;
    }
  }

  if (released > 0) {
    console.info(`[settlement] released ${released} held share(s) for ${accountId}`);
  }
  return released;
}

type StripeClient = NonNullable<ReturnType<typeof getStripeOrNull>>;

/**
 * The platform's USD balance that is actually movable right now, or null if
 * Stripe could not be asked.
 */
async function availableUsdCents(stripe: StripeClient): Promise<number | null> {
  try {
    const balance = await stripe.balance.retrieve();
    return balance.available.find((a) => a.currency === CURRENCY)?.amount ?? 0;
  } catch (err) {
    console.error("[settlement] could not read the platform balance:", err);
    return null;
  }
}

/**
 * Sends every share that is waiting on settled platform funds.
 *
 * Reads the settlement rows book-kept by /end but not yet paid out, checks the
 * platform's available balance actually covers them, and sends each one that
 * qualifies. Triggered twice: by Stripe's `balance.available` event, which
 * fires when a charge moves out of `pending` -- the only moment a transfer like
 * this can succeed -- and by the scheduled /api/cron/settle sweep.
 *
 * Two kinds of leg qualify, because both record that Stripe did NOT send the
 * money: `pending` (booked, or waiting on funds) and `held` (funds or
 * recipient not ready). Either is safe to send, or re-send, under a fresh
 * idempotency key. `failed` legs are left alone -- those are Stripe rejections
 * a person has to look at, and replaying them automatically is how a payment
 * gets made twice.
 *
 * Returns how many legs actually went out.
 */
export async function retryOutstandingSettlements(): Promise<number> {
  const admin = getSupabaseAdmin();
  const stripe = getStripeOrNull();
  if (!stripe) return 0;

  const { data: unsettledRows, error } = await admin
    .from("event_settlements")
    .select(SETTLEMENT_SELECT)
    .in("status", ["in_progress", "partial"])
    .or("organizer_status.in.(pending,held),dj_status.in.(pending,held)");

  if (error || !unsettledRows?.length) return 0;
  const rows = unsettledRows as SettlementRow[];

  const outstanding = rows.reduce((sum, row) => {
    if (row.organizer_status === "pending" || row.organizer_status === "held") {
      sum += row.organizer_cents;
    }
    if (row.dj_status === "pending" || row.dj_status === "held") {
      sum += row.dj_cents;
    }
    return sum;
  }, 0);
  if (outstanding <= 0) return 0;

  // `balance.available` also fires on balance changes we cannot spend against,
  // and retrying a leg we still cannot fund only burns an idempotency key.
  const available = await availableUsdCents(stripe);
  if (available === null || available < outstanding) {
    console.info(
      `[settlement] balance not ready yet: ${available ?? "?"}c available, ` +
        `${outstanding}c outstanding across ${rows.length} settlement(s)`
    );
    return 0;
  }

  const { data: eventRows } = await admin
    .from("events")
    .select("id, dj_id, status, name, organization_id")
    .in(
      "id",
      rows.map((row) => row.event_id)
    );
  const eventsById = new Map(
    ((eventRows ?? []) as EventRow[]).map((event) => [event.id, event])
  );

  // The settlement row snapshots the organization at /end, but an event can be
  // closed before its organizer has been invited (or onboarded). Resolve the
  // *live* organization now so a late invite still pays the right account.
  const orgIds = [
    ...new Set(
      ((eventRows ?? []) as EventRow[])
        .map((event) => event.organization_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const orgAccountsById = new Map<string, string | null>();
  if (orgIds.length > 0) {
    const { data: orgRows } = await admin
      .from("organizations")
      .select("id, stripe_account_id")
      .in("id", orgIds);
    for (const org of orgRows ?? []) {
      orgAccountsById.set(org.id, org.stripe_account_id ?? null);
    }
  }

  let released = 0;

  for (const row of rows) {
    const event = eventsById.get(row.event_id);
    if (!event) continue;
    // Without the DJ's session the event cannot be closed, so a settlement
    // that somehow left its event live is left for the DJ's own retry.
    if (event.status !== "ended") {
      console.warn(
        `[settlement] skipping ${row.event_id}: event is still ${event.status}`
      );
      continue;
    }

    const finance = financeFromSettlement(row);
    if (event.organization_id) {
      finance.organization_id = event.organization_id;
      const liveOrgAccountId = orgAccountsById.get(event.organization_id) ?? null;
      if (liveOrgAccountId) {
        finance.organization_stripe_account_id = liveOrgAccountId;
      }
      // Persist the refreshed link so the record (and releaseHeldShares, which
      // matches on the account id) catches up with an organizer added after
      // the event was closed.
      if (
        row.organization_id !== finance.organization_id ||
        row.organization_stripe_account_id !== finance.organization_stripe_account_id
      ) {
        const { error: refreshError } = await admin
          .from("event_settlements")
          .update({
            organization_id: finance.organization_id,
            organization_stripe_account_id: finance.organization_stripe_account_id,
          })
          .eq("id", row.id);
        if (refreshError) {
          console.warn(
            `[settlement] could not refresh the organizer link on ${row.event_id}:`,
            refreshError
          );
        }
      }
    }

    const legs = await distribute({
      admin,
      supabase: admin,
      event,
      settlementId: row.id,
      finance,
      djAccountId: await getDjConnectId(row.dj_id),
      current: {
        organizer: {
          status: row.organizer_status,
          attempt: row.organizer_attempt,
          failureReason: row.organizer_failure_reason,
        },
        dj: {
          status: row.dj_status,
          attempt: row.dj_attempt,
          failureReason: row.dj_failure_reason,
        },
      },
      updatedAt: row.updated_at,
    });

    if (!legs.ok) {
      console.error(`[settlement] could not retry ${row.event_id}: ${legs.error}`);
      continue;
    }

    // distribute() already wrote the outcomes; read them back rather than
    // trusting the summary's shape to double as a leg state.
    const after = await loadSettlement(admin, row.event_id);
    if (after && row.dj_status !== "sent") {
      await writePayout(admin, row.event_id, row.dj_id, after.dj_cents, {
        status: after.dj_status,
        attempt: after.dj_attempt,
        failureReason: after.dj_failure_reason,
      });
    }
    if (row.organizer_status !== "sent" && after?.organizer_status === "sent") {
      released += 1;
    }
    if (row.dj_status !== "sent" && after?.dj_status === "sent") {
      released += 1;
    }
  }

  if (released > 0) {
    console.info(`[settlement] released ${released} outstanding share(s)`);
  }
  return released;
}

async function loadEventNames(
  admin: SupabaseClient,
  eventIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(eventIds)];
  if (unique.length === 0) return map;

  const { data } = await admin.from("events").select("id, name").in("id", unique);
  for (const row of (data ?? []) as { id: string; name: string }[]) {
    map.set(row.id, row.name);
  }
  return map;
}

/**
 * Sends the organizer and DJ shares, then writes both outcomes in one update.
 *
 * A leg with nothing to pay counts as sent rather than pending: a gig with no
 * organizer, or no spending guests, should close as settled instead of
 * reporting a hold nobody can ever clear.
 *
 * The legs run one after another on purpose. They write different columns, but
 * running them concurrently means a throw on one can strand the other's
 * recorded attempt without ever reaching the outcome update below.
 */
async function executeLegs({
  admin,
  settlementId,
  eventId,
  eventName,
  djAccountId,
  organizer,
  dj,
  current,
  updatedAt,
  only,
  onlyRetryPendingOrHeld = true,
}: {
  admin: SupabaseClient;
  settlementId: string;
  eventId: string;
  eventName: string;
  djAccountId: string | null;
  organizer: { cents: number; destination: string | null };
  dj: { cents: number; destination: string | null };
  current: { organizer: LegState; dj: LegState };
  updatedAt: string;
  /**
   * Limits work to the leg that belongs to the account this call was made for.
   * The webhook releases held funds when ONE account finishes onboarding, and
   * must not reach into an unrelated account that happens to share a
   * settlement.
   */
  only?: "organizer" | "dj";
  /**
   * When true (the default), a leg recorded as `failed` is left untouched.
   * Failed is Stripe's answer on record and needs a person; replaying it on an
   * automated schedule under a fresh idempotency key risks paying twice.
   */
  onlyRetryPendingOrHeld?: boolean;
}): Promise<{ organizer: LegState; dj: LegState; error?: string | null }> {
  const runLeg = async (
    leg: "organizer" | "dj",
    label: string,
    cents: number,
    destination: string | null,
    state: LegState
  ): Promise<LegState> => {
    if (cents <= 0) {
      return { status: "sent", attempt: state.attempt, failureReason: null };
    }
    if (state.status === "sent") return state;
    if (onlyRetryPendingOrHeld && state.status === "failed") return state;

    const ready = await recipientReady(destination);
    if (!ready.ready) {
      // Stripe was never called, so neither the attempt counter nor the
      // ambiguity of 'pending' applies: this is a hold we can retry freely
      // once the recipient finishes onboarding.
      return { status: "held", attempt: state.attempt, failureReason: ready.reason };
    }
    const attempt = state.attempt + 1;
    // Only a leg whose last outcome was never stored can be ambiguous. 'held'
    // and 'failed' both record a definite outcome (or no Stripe call at all),
    // so the window check below must not fire for them.
    if (state.status === "pending" && state.attempt > 0) {
      const lastTouch = Date.parse(updatedAt);
      if (Number.isFinite(lastTouch) && Date.now() - lastTouch > IDEMPOTENCY_WINDOW_MS) {
        throw new Error(
          `The ${label} share has an interrupted transfer attempt that is outside ` +
            `Stripe's 24-hour dedupe window. Reconcile it in the Stripe dashboard ` +
            `before retrying so it isn't sent twice.`
        );
      }
    }

    // Record the attempt BEFORE calling Stripe. This is the only evidence that
    // a transfer may have gone out if the process dies mid-call.
    const { error: attemptError } = await admin
      .from("event_settlements")
      .update({ [`${leg}_attempt`]: attempt, updated_at: new Date().toISOString() })
      .eq("id", settlementId);
    if (attemptError) {
      throw new Error("Could not record the transfer attempt. Please retry.");
    }

    const result = await transferTo({
      eventId,
      leg,
      amountCents: cents,
      destination: destination as string,
      attempt,
      description: `BidaBeat settlement - ${eventName} (${label} share)`,
    });

    if ("transferId" in result) {
      return { status: "sent", attempt, failureReason: null };
    }
    // A rejection Stripe made before creating the transfer is a hold, not a
    // failure: nothing went out, so a later attempt under a fresh key cannot
    // pay twice. This is what a platform balance that has not settled into
    // `available` yet looks like.
    return result.retryable
      ? { status: "held", attempt, failureReason: result.failureReason }
      : { status: "failed", attempt, failureReason: result.failureReason };
  };

  let legs: { organizer: LegState; dj: LegState };
  try {
    const organizerState =
      only === "dj"
        ? current.organizer
        : await runLeg(
            "organizer",
            "Organizer",
            organizer.cents,
            organizer.destination,
            current.organizer
          );
    const djState =
      only === "organizer"
        ? current.dj
        : await runLeg(
            "dj",
            "DJ",
            dj.cents,
            dj.destination ?? djAccountId,
            current.dj
          );
    legs = { organizer: organizerState, dj: djState };
  } catch (err) {
    // Nothing is written, so the row stays 'in_progress' with its old attempt
    // numbers and a retry re-runs the same idempotency keys.
    return {
      ...current,
      error: err instanceof Error ? err.message : "Could not distribute the funds.",
    };
  }

  const status =
    legs.organizer.status === "sent" && legs.dj.status === "sent"
      ? "settled"
      : "partial";

  const { error } = await admin
    .from("event_settlements")
    .update({
      status,
      organizer_status: legs.organizer.status,
      organizer_attempt: legs.organizer.attempt,
      organizer_failure_reason: legs.organizer.failureReason,
      dj_status: legs.dj.status,
      dj_attempt: legs.dj.attempt,
      dj_failure_reason: legs.dj.failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settlementId);

  if (error) {
    // Leaving it 'in_progress' is deliberate: a retry re-runs these legs with
    // the same attempt numbers and Stripe dedupes anything already sent.
    console.error("[settlement] could not record outcomes:", error);
    return { ...legs, error: "Could not record the distribution. Please retry." };
  }

  return legs;
}

/**
 * The DJ's earnings page reads dj_payouts, so write it whether or not the
 * transfer landed -- a held payout still has to be visible to them. Skipped
 * when there is nothing to pay, so a $0 gig does not create a fake payout.
 */
async function writePayout(
  admin: SupabaseClient,
  eventId: string,
  djId: string,
  cents: number,
  leg: LegState
): Promise<void> {
  if (cents <= 0) return;

  const status =
    leg.status === "sent" ? "processing" : leg.status === "failed" ? "failed" : "pending";

  const { error } = await admin
    .from("dj_payouts")
    .upsert(
      { dj_id: djId, event_id: eventId, amount_cents: cents, status },
      { onConflict: "event_id" }
    );
  if (error) console.error("[settlement] could not record the payout:", error);
}

async function loadSettlement(
  admin: SupabaseClient,
  eventId: string
): Promise<SettlementRow | null> {
  const { data } = await admin
    .from("event_settlements")
    .select(SETTLEMENT_SELECT)
    .eq("event_id", eventId)
    .maybeSingle();
  return (data as SettlementRow | null) ?? null;
}

type DjClient = SupabaseClient;

/**
 * Flips the event to ended. Authorization to do so was already established by
 * the caller -- settleEvent() verified the actor owns the event before it got
 * here, and retries only run against events that are already ended. Idempotent,
 * so calling it after a partial failure just completes the job. Returns null
 * on success.
 */
async function closeEvent(
  supabase: DjClient,
  eventId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("events")
    .update({ status: "ended" })
    .eq("id", eventId)
    .select("status")
    .maybeSingle();

  if (error) return error.message;
  // PostgREST reports an RLS-blocked update as zero rows, not an error.
  if (!data) return "No permission to update this event.";
  return null;
}

async function getDjConnectId(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("dj_owner_profiles")
    .select("stripe_connect_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_connect_id ?? null;
}

function financeFromSettlement(row: SettlementRow): FinanceRow {
  return {
    organization_id: null,
    organization_stripe_account_id: row.organization_stripe_account_id,
    dj_rate: row.dj_rate,
    organizer_rate: row.organizer_rate,
    platform_rate: row.platform_rate,
    total_revenue_cents: row.total_revenue_cents,
    total_fees_cents: row.stripe_fees_cents,
    net_revenue_cents: row.net_revenue_cents,
    organizer_cents: row.organizer_cents,
    organizer_gross_cents: row.organizer_gross_cents,
    organizer_fee_cents: row.organizer_fee_cents,
    dj_cents: row.dj_cents,
    dj_gross_cents: row.dj_gross_cents,
    dj_fee_cents: row.dj_fee_cents,
    platform_cents: row.platform_cents,
  };
}

function toSummary(row: SettlementRow, alreadySettled: boolean): SettlementSummary {
  return {
    settlementId: row.id,
    status: row.status,
    totalRevenueCents: Number(row.total_revenue_cents),
    totalFeesCents: Number(row.stripe_fees_cents),
    netRevenueCents: Number(row.net_revenue_cents),
    organizerCents: Number(row.organizer_cents),
    organizerGrossCents: Number(row.organizer_gross_cents),
    organizerFeeCents: Number(row.organizer_fee_cents),
    djCents: Number(row.dj_cents),
    djGrossCents: Number(row.dj_gross_cents),
    djFeeCents: Number(row.dj_fee_cents),
    platformCents: Number(row.platform_cents),
    organizerRate: Number(row.organizer_rate),
    djRate: Number(row.dj_rate),
    platformRate: Number(row.platform_rate),
    organizer: {
      status: row.organizer_status,
      failureReason: row.organizer_failure_reason,
    },
    dj: { status: row.dj_status, failureReason: row.dj_failure_reason },
    alreadySettled,
  };
}
