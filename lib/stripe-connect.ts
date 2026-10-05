import type Stripe from "stripe";
import { getAppUrl, getStripe } from "@/lib/stripe";

/**
 * Stripe Connect helpers for DJ payout accounts.
 *
 * Accounts are created through the Accounts v2 API (POST /v2/core/accounts).
 * The v1 `accounts.create` path is closed to new integrations, so every call
 * here targets v2 and reads v2 shapes.
 *
 * Server-only module — never import from a client component.
 */

/**
 * Country declared on the connected account's identity. This must match where
 * the DJ actually resides, because Stripe validates onboarding documents
 * against it. Override with STRIPE_DJ_CONNECT_COUNTRY when onboarding DJs
 * outside the default market.
 */
const DEFAULT_DJ_CONNECT_COUNTRY = "US";

export function getDjConnectCountry(): string {
  return process.env.STRIPE_DJ_CONNECT_COUNTRY?.trim() || DEFAULT_DJ_CONNECT_COUNTRY;
}

/**
 * Creates the connected account that receives a DJ's payouts.
 *
 * Three request fields are load-bearing and easy to get wrong:
 *  - `stripe_transfers` lives under `stripe_balance`, not directly on the
 *    recipient configuration.
 *  - `defaults.responsibilities` becomes mandatory once that capability is
 *    requested, and both roles must be "application": Stripe rejects
 *    "stripe" for this configuration set.
 *  - `dashboard: "express"` is only allowed because the account carries the
 *    recipient configuration above.
 */
export async function createDjConnectAccount(params: {
  email?: string | null;
  userId: string;
  /** Public profile slug, used as the account's business URL. */
  publicSlug?: string | null;
}): Promise<string> {
  const account = await getStripe().v2.core.accounts.create({
    contact_email: params.email ?? undefined,
    dashboard: "express",
    identity: {
      country: getDjConnectCountry(),
      entity_type: "individual",
    },
    defaults: {
      // Supplying the profile URL clears the `defaults.profile.business_url`
      // requirement, which Stripe would otherwise leave open.
      ...(params.publicSlug
        ? {
            profile: {
              business_url: `${getAppUrl()}/dj-profile/${params.publicSlug}`,
            },
          }
        : {}),
      responsibilities: {
        losses_collector: "application",
        fees_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: { role: "dj", user_id: params.userId },
  });

  return account.id;
}

/**
 * Mints the hosted onboarding link the DJ is redirected into.
 *
 * `fields: "eventually_due"` is what makes onboarding ask for date of birth and
 * the last four of the SSN. Those requirements exist from the start but are
 * normally only flagged once volume reaches a threshold, and the default
 * ("currently_due") leaves them uncollected -- the DJ would then be told
 * payouts were restricted only after they had already onboarded.
 */
export async function createDjOnboardingLink(accountId: string): Promise<string> {
  const link = await getStripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        collection_options: { fields: "eventually_due" },
        refresh_url: `${getAppUrl()}/dj/connect?refresh=1`,
        return_url: `${getAppUrl()}/dj/events?connect=1`,
      },
    },
  });

  return link.url;
}

type CapabilityStatus = { status?: string } | undefined;

export interface DjConnectAccountStatus {
  recipientApplied: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  connected: boolean;
  /** Requirement descriptions Stripe still wants from this DJ. */
  pendingRequirements: string[];
}

function balanceCapability(
  account: Stripe.V2.Core.Account,
  capability: "payouts" | "stripe_transfers"
): CapabilityStatus {
  return account.configuration?.recipient?.capabilities?.stripe_balance?.[capability];
}

/**
 * Live onboarding state for a connected account.
 *
 * Accounts v2 has no `details_submitted` / `payouts_enabled` booleans: a v1
 * `accounts.retrieve` on a v2 account returns `false` for both even while
 * onboarding is healthy, so the truth has to come from the v2 capability
 * statuses under `configuration.recipient`.
 */
export async function fetchDjConnectAccountStatus(
  accountId: string
): Promise<DjConnectAccountStatus> {
  const account = await getStripe().v2.core.accounts.retrieve(accountId, {
    include: ["requirements", "configuration.recipient"],
  });

  const requirements = account.requirements?.entries ?? [];
  const pendingRequirements = requirements.map((e) => e.description).filter(Boolean);
  const detailsSubmitted = requirements.length === 0;

  const payoutsStatus = balanceCapability(account, "payouts")?.status;
  const transfersStatus = balanceCapability(account, "stripe_transfers")?.status;

  const payoutsEnabled = payoutsStatus === "active";
  const transfersEnabled = transfersStatus === "active";

  return {
    recipientApplied: account.configuration?.recipient?.applied === true,
    detailsSubmitted,
    payoutsEnabled,
    transfersEnabled,
    connected: payoutsEnabled && transfersEnabled,
    pendingRequirements,
  };
}

/** Reads the DJ's auth user id back off the connected account's metadata. */
export async function fetchDjConnectAccountUserId(accountId: string): Promise<string | null> {
  const account = await getStripe().v2.core.accounts.retrieve(accountId);
  return account.metadata?.user_id ?? null;
}