import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/app-url";

/**
 * Signed, non-expiring tokens for the organizer payout dashboard link.
 *
 * Organizers are not BidaBeat users and never sign in, so the link we email
 * cannot rely on a session. Stripe's Express dashboard login link is
 * single-use and short-lived, so it cannot sit in an inbox either. Instead we
 * email a URL on our own domain carrying one of these tokens; the route
 * re-mints a fresh Stripe login link on every visit.
 *
 * The token only proves "this organization was invited to view its payouts" --
 * a short HMAC over the organization id is enough, because there is no session
 * or privilege behind it and nothing secret is embedded in the value. The HMAC
 * is what makes the handler unique per organizer and unforgeable without the
 * signing secret; a raw organization id would be guessable.
 *
 * Server-only module — never import from a client component.
 */

export interface OrganizerDashboardClaim {
  organizationId: string;
}

/**
 * Server-only signing key. Falls back to other server secrets so the feature
 * works without a new variable, but ORGANIZER_INVITE_SECRET should be set so
 * rotating the cron or service-role secret does not invalidate live links.
 */
function dashboardSecret(): string {
  const secret =
    process.env.ORGANIZER_INVITE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Organizer dashboard links need a signing secret: set ORGANIZER_INVITE_SECRET."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", dashboardSecret()).update(payload).digest("base64url");
}

export function createOrganizerDashboardToken(
  claim: OrganizerDashboardClaim
): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOrganizerDashboardToken(
  token: string
): OrganizerDashboardClaim | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<OrganizerDashboardClaim>;
    const organizationId =
      typeof parsed.organizationId === "string" ? parsed.organizationId : "";
    if (!organizationId) return null;
    return { organizationId };
  } catch {
    return null;
  }
}

/** The stable, reopenable payout-dashboard URL that is emailed to the organizer. */
export function organizerDashboardUrl(claim: OrganizerDashboardClaim): string {
  return `${getAppUrl()}/organizer/dashboard/${createOrganizerDashboardToken(claim)}`;
}
