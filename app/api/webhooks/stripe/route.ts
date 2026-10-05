import { NextRequest, NextResponse } from "next/server";
import { getCreditPack, getStripe } from "@/lib/stripe";
import { fetchDjConnectAccountUserId } from "@/lib/stripe-connect";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhooks.
 *
 * Two payload shapes arrive on the same URL, and each is signed with a
 * different secret: the v1 webhook endpoint and the v2 event destination cannot
 * share one. So every payload is verified against both secrets and the one that
 * matches is used (see getSigningSecrets / verifyWithAnySecret). Which secret
 * verified is unrelated to payload shape -- shape alone decides the parser:
 *   - v1 events, parsed with `webhooks.constructEvent`.
 *   - v2 "thin" event notifications (Accounts v2, e.g.
 *     `v2.core.account[configuration.recipient].capability_status_updated`),
 *     parsed with `parseEventNotification`. These carry no object snapshot, so
 *     the handler re-reads the account from Stripe to resolve its metadata.
 *
 * Handled events:
 *   - checkout.session.completed (type = dj_activation_fee)
 *       → marks the DJ's one-time activation fee as paid.
 *   - checkout.session.completed (type = credit_purchase)
 *       → records a hosted-Checkout credit purchase.
 *   - payment_intent.succeeded (type = credit_purchase)
 *       → records an off-session credit purchase against the guest's saved
 *         card. This is the normal path, since guests save a card at signup.
 *   - payment_intent.payment_failed / .canceled (type = credit_purchase)
 *       → acknowledged; nothing is granted on failure.
 *   - setup_intent.succeeded (metadata.user_id)
 *       → saves the guest's Stripe customer + payment method refs on profiles.
 *   - setup_intent.canceled
 *       → acknowledged; the profile keeps any previously saved card.
 *   - account.updated (v1) and the v2.core.account[*] family
 *       → link the connected account to its DJ.
 *
 * handlers are idempotent: updates are keyed by stable PKs / event values, so
 * a replayed event converges to the same state and any credit ledger writes
 * are protected by unique stripe-intent indexes.
 */

/** v2 account events that can change what BidaBeat knows about a DJ. */
const V2_ACCOUNT_EVENT_TYPES = new Set([
  "v2.core.account.created",
  "v2.core.account.updated",
  "v2.core.account.closed",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[requirements].updated",
  "v2.core.account[future_requirements].updated",
]);

/**
 * Reads the related account id off a v2 notification.
 *
 * Every account event variant includes related_object, but the notification
 * union also contains variants that do not, so the field has to be read
 * defensively.
 */
function relatedObjectId(notification: unknown): string | null {
  const related = (notification as { related_object?: { id?: unknown } | null })
    ?.related_object;
  const id = related?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function isV2Notification(payload: string): boolean {
  try {
    const parsed = JSON.parse(payload) as { object?: string; type?: string };
    return parsed?.object !== "event" && typeof parsed?.type === "string";
  } catch {
    return false;
  }
}

/**
 * Every signing secret this endpoint accepts, in priority order.
 *
 * A v1 webhook endpoint and a v2 event destination cannot share a secret even
 * when they point at the same URL, so this route has to verify each payload
 * against all of them and keep the one that matches. Which secret verified is
 * independent of whether the payload is a v1 event or a v2 notification --
 * those are told apart by payload shape (see isV2Notification).
 */
function getSigningSecrets(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_V2,
  ].map((s) => s?.trim()).filter((s): s is string => Boolean(s));
}

/**
 * Runs `parse` against each candidate secret and returns the first result that
 * verifies. Throws only when every candidate rejects the signature.
 */
function verifyWithAnySecret<T>(
  secrets: string[],
  parse: (secret: string) => T
): T {
  if (secrets.length === 0) {
    throw new Error("No Stripe webhook signing secrets are configured.");
  }
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return parse(secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest) {
  const secrets = getSigningSecrets();
  if (secrets.length === 0) {
    return NextResponse.json({ error: "Stripe webhook secret is not set." }, { status: 503 });
  }

  let payload: string;
  let signature: string | null;
  try {
    payload = await req.text();
    signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const stripe = getStripe();

  if (isV2Notification(payload)) {
    let notification;
    try {
      notification = verifyWithAnySecret(secrets, (secret) =>
        stripe.parseEventNotification(payload, signature!, secret)
      );
    } catch (err) {
      console.error("[webhook stripe] v2 signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (V2_ACCOUNT_EVENT_TYPES.has(notification.type)) {
      // Not every notification variant carries related_object, so narrow
      // instead of assuming it on the union.
      const accountId = relatedObjectId(notification);
      if (accountId) {
        try {
          await linkConnectAccountToDj(accountId);
        } catch (err) {
          console.error(`[webhook stripe] ${notification.type} handling failed:`, err);
          return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ received: true });
  }

  let event;
  try {
    event = verifyWithAnySecret(secrets, (secret) =>
      stripe.webhooks.constructEvent(payload, signature!, secret)
    );
  } catch (err) {
    console.error("[webhook stripe] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
          payment_intent?: string | StripePaymentIntentRef;
        };
        const metadata = session.metadata ?? {};
        if (metadata.type === "dj_activation_fee" && metadata.userId) {
          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : null;

          const supabase = getSupabaseAdmin();
          const { error } = await supabase.rpc("mark_dj_fee_paid", {
            p_user_id: metadata.userId,
            p_intent_id: paymentIntentId ?? "",
          });
          if (error) throw error;
          console.info(`[webhook stripe] DJ activated: ${metadata.userId}`);
        }

        if (metadata.type === "credit_purchase") {
          await fulfillCreditPurchase(event.id, event.data.object as never);
        }
        break;
      }
      case "payment_intent.succeeded": {
        // The off-session path: charging the guest's saved card never goes
        // through Checkout, so the session handler above never fires for it.
        // Keyed on the PaymentIntent id, so a purchase that also produced a
        // session event is recorded exactly once.
        const intent = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
        };
        if (intent.metadata?.type === "credit_purchase") {
          await fulfillCreditPurchase(intent.id, intent);
        }
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        // Nothing is granted on failure, so this only needs acknowledging.
        const intent = event.data.object as {
          id: string;
          metadata?: Record<string, string | undefined>;
        };
        if (intent.metadata?.type === "credit_purchase") {
          console.info(
            `[webhook stripe] credit purchase ${intent.id} did not complete: ${event.type}`
          );
        }
        break;
      }
      case "setup_intent.succeeded": {
        const intent = event.data.object as {
          id: string;
          customer?: string | null;
          payment_method?: string | { id: string } | null;
          metadata?: { user_id?: string };
        };
        const userId = intent.metadata?.user_id;
        if (!userId) {
          console.warn("[webhook stripe] setup_intent.succeeded without metadata.user_id; ignoring.");
          break;
        }

        const customerId = typeof intent.customer === "string" ? intent.customer : null;
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
            console.warn("[webhook stripe] could not retrieve payment method:", err);
          }
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId ?? undefined,
            stripe_payment_method_id: pmId ?? undefined,
            card_brand: card?.brand ?? null,
            card_last4: card?.last4 ?? null,
            card_exp_month: card?.exp_month ?? null,
            card_exp_year: card?.exp_year ?? null,
          })
          .eq("id", userId);
        if (error) throw error;
        console.info(`[webhook stripe] card saved for ${userId}`);
        break;
      }
      case "setup_intent.canceled": {
        console.info(
          `[webhook stripe] setup_intent canceled: ${(event.data.object as { id: string }).id}`
        );
        break;
      }
      case "account.updated": {
        // Connect (v1) account status change for a DJ payout account.
        // Kept for accounts created before the Accounts v2 migration; v2
        // accounts emit `v2.core.account[*]` events instead.
        const account = event.data.object as {
          id: string;
          details_submitted?: boolean;
          payouts_enabled?: boolean;
          metadata?: Record<string, string | undefined>;
        };
        const userId = account.metadata?.user_id;
        if (userId) {
          await saveConnectAccountForDj(userId, account.id);
          console.info(
            `[webhook stripe] Connect account ${account.id} details_submitted=${account.details_submitted} payouts_enabled=${account.payouts_enabled}`
          );
        }
        break;
      }
      default:
        // Unhandled events are acknowledged quietly.
        break;
    }
  } catch (err) {
    console.error("[webhook stripe] handler failed:", err);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type StripePaymentIntentRef = { id: string };

/** Upserts the connected account onto its DJ, keyed by the auth user id. */
async function saveConnectAccountForDj(
  userId: string,
  connectId: string
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("dj_owner_profiles")
    .upsert(
      { user_id: userId, stripe_connect_id: connectId },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}

/**
 * Resolves a v2 connected account's DJ from its metadata and links them.
 *
 * v2 notifications carry no account snapshot, so the owner has to be read back
 * from Stripe; the metadata written at account creation is what ties the
 * account to a user.
 */
async function linkConnectAccountToDj(accountId: string): Promise<void> {
  const userId = await fetchDjConnectAccountUserId(accountId);
  if (!userId) {
    console.warn(
      `[webhook stripe] connected account ${accountId} has no metadata.user_id; ignoring.`
    );
    return;
  }
  await saveConnectAccountForDj(userId, accountId);
  console.info(`[webhook stripe] linked connected account ${accountId} to ${userId}`);
}

/**
 * Grants purchased credits and records the financial ledger row.
 *
 * Credits and revenue are stored in separate columns and must not be conflated:
 * a $20.00 pack grants 23 credits, but only $20.00 was collected, so the
 * 70/20/10 split must later be computed from revenue_cents alone.
 *
 * The grant is delegated to record_credit_purchase(), keyed on the Stripe
 * reference. Every path that can report a successful purchase -- the Checkout
 * session, the PaymentIntent, the client's finalize call -- passes the same
 * PaymentIntent id, and only the first is recorded. Stripe retries webhook
 * deliveries, and this is what stands between a retry and double-crediting.
 */
async function fulfillCreditPurchase(
  stripeReference: string,
  source: {
    id: string;
    metadata?: Record<string, string | undefined>;
    payment_intent?: string | StripePaymentIntentRef;
  }
): Promise<void> {
  const metadata = source.metadata ?? {};
  const userId = metadata.userId;
  const packId = metadata.packId;
  const eventId = metadata.eventId;

  if (!userId || !packId || !eventId) {
    console.error(
      `[webhook stripe] credit_purchase ${source.id} missing userId/packId/eventId; ignoring.`
    );
    return;
  }

  // Price from the server-side catalog, not from metadata. Metadata is written
  // by our own server, but trusting it would let a tampered session decide how
  // many credits a payment is worth.
  const pack = getCreditPack(packId);
  if (!pack) {
    console.error(
      `[webhook stripe] credit_purchase ${source.id} has unknown packId ${packId}; ignoring.`
    );
    return;
  }

  // Always key on the PaymentIntent, even for Checkout sessions, so the two
  // webhook paths cannot each record the same sale.
  const paymentIntentId =
    typeof source.payment_intent === "string"
      ? source.payment_intent
      : source.id.startsWith("pi_")
        ? source.id
        : null;

  const reference = paymentIntentId ?? source.id;

  const { data, error } = await getSupabaseAdmin().rpc("record_credit_purchase", {
    p_event_id: eventId,
    p_user_id: userId,
    p_stripe_reference: reference,
    p_stripe_payment_intent_id: paymentIntentId,
    p_credits_granted: pack.credits,
    p_revenue_cents: pack.revenueCents,
  });

  if (error) throw error;
  console.info(
    `[webhook stripe] recorded ${reference}: ${data?.credits_granted ?? pack.credits} credits ` +
      `(${data?.revenue_cents ?? pack.revenueCents}c) for ${userId} on event ${eventId}`
  );
}