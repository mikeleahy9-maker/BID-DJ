import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/app-url";

/**
 * Signed, non-expiring tokens for the organizer invite link.
 *
 * Stripe account links are single-use and expire within minutes, so the Stripe
 * URL itself cannot live in an email. Instead we email a URL on our own domain
 * carrying one of these tokens; the route re-mints a fresh Stripe link on every
 * visit. The token only proves "this organization was invited to this event", so
 * a short HMAC over the ids is enough -- there is no session or privilege behind
 * it, and nothing secret is embedded in the value.
 */

export interface OrganizerInvite {
  organizationId: string;
  eventId: string;
}

/**
 * Server-only signing key. Falls back to other server secrets so the feature
 * works without a new variable, but ORGANIZER_INVITE_SECRET should be set so
 * rotating the cron or service-role secret does not invalidate live invites.
 */
function inviteSecret(): string {
  const secret =
    process.env.ORGANIZER_INVITE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Organizer invites need a signing secret: set ORGANIZER_INVITE_SECRET."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", inviteSecret()).update(payload).digest("base64url");
}

export function createOrganizerInviteToken(invite: OrganizerInvite): string {
  const payload = Buffer.from(JSON.stringify(invite)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOrganizerInviteToken(token: string): OrganizerInvite | null {
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
    ) as Partial<OrganizerInvite>;
    const organizationId =
      typeof parsed.organizationId === "string" ? parsed.organizationId : "";
    const eventId = typeof parsed.eventId === "string" ? parsed.eventId : "";
    if (!organizationId || !eventId) return null;
    return { organizationId, eventId };
  } catch {
    return null;
  }
}

/** The stable, reopenable invite URL that is emailed to the organizer. */
export function organizerInviteUrl(invite: OrganizerInvite): string {
  return `${getAppUrl()}/organizer/invite/${createOrganizerInviteToken(invite)}`;
}
