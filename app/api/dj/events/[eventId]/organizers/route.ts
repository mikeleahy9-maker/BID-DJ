import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { organizerInviteEmail, sendEmail } from "@/lib/email";
import { organizerInviteUrl } from "@/lib/organizer-invite-token";
import {
  createOrganizationConnectAccount,
  fetchDjConnectAccountStatus,
} from "@/lib/stripe-connect";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface OrganizerSummary {
  id: string;
  name: string;
  email: string;
  status: string;
  onboardedAt: string | null;
  hasStripeAccount: boolean;
  /** Live truth: the account can receive destination transfers right now. */
  ready: boolean;
}

/**
 * Invites (or re-invites) the organizer for an event: creates (or reuses) the
 * organization and its Stripe Connect account, then EMAILS a stable invite link.
 *
 * The emailed link points at our own /organizer/invite route, never at Stripe: a
 * Stripe account link is single-use and expires within minutes, so it cannot sit
 * in an inbox. That route re-mints a fresh Stripe link on every visit, which is
 * what makes the email reopenable.
 *
 * The URL is only returned to the caller as a fallback when the email could not
 * be sent (SendGrid unset or rejected), so the DJ can still pass the link on by
 * hand rather than the invite failing silently.
 *
 * The organization is keyed on contact_email (case-insensitive) so re-inviting
 * the same venue reuses its existing Connect account rather than creating a
 * second one, which Stripe rejects as a duplicate.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { eventId } = await params;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
  }

  let body: { name?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!name) {
    return NextResponse.json(
      { error: "Please enter the organizer's name." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, name, dj_id, status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("[invite-organizer] event lookup failed:", eventError);
    return NextResponse.json({ error: "Could not load the event." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.dj_id !== user.id) {
    return NextResponse.json(
      { error: "Only the event owner can invite the organizer." },
      { status: 403 }
    );
  }

  // The organizer receives the event's non-DJ share, so who it is has to be
  // settled before the night starts. Once the event is live (or ended) the
  // organizer is locked rather than silently re-pointed.
  if (event.status !== "draft") {
    return NextResponse.json(
      {
        error:
          "The organizer can only be changed while the event is still a draft.",
      },
      { status: 409 }
    );
  }

  // Upsert on lower(contact_email) to match organizations_contact_email_key.
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id, name, contact_email, stripe_account_id, status, onboarded_at")
    .eq("contact_email", email)
    .maybeSingle();

  let organizationId: string;
  let stripeAccountId: string | null;

  if (existingOrg) {
    organizationId = existingOrg.id;
    stripeAccountId = existingOrg.stripe_account_id ?? null;
    const { error: updateError } = await admin
      .from("organizations")
      .update({ name })
      .eq("id", organizationId);
    if (updateError) {
      console.error("[invite-organizer] org update failed:", updateError);
      return NextResponse.json(
        { error: "Could not update the organizer." },
        { status: 500 }
      );
    }
  } else {
    const { data: createdOrg, error: insertError } = await admin
      .from("organizations")
      .insert({ name, contact_email: email })
      .select("id, stripe_account_id")
      .single();

    if (insertError) {
      console.error("[invite-organizer] org insert failed:", insertError);
      return NextResponse.json(
        { error: "Could not create the organizer." },
        { status: 500 }
      );
    }
    organizationId = createdOrg.id;
    stripeAccountId = createdOrg.stripe_account_id ?? null;
  }

  const { error: linkError } = await admin
    .from("events")
    .update({ organization_id: organizationId })
    .eq("id", eventId);

  if (linkError) {
    console.error("[invite-organizer] event link failed:", linkError);
    return NextResponse.json(
      { error: "Could not attach the organizer to this event." },
      { status: 500 }
    );
  }

  if (!stripeAccountId) {
    try {
      stripeAccountId = await createOrganizationConnectAccount({
        email,
        organizationId,
      });
    } catch (err) {
      console.error("[invite-organizer] connect account failed:", err);
      return NextResponse.json(
        { error: "Could not create a Stripe account for the organizer." },
        { status: 502 }
      );
    }

    const { error: saveError } = await admin
      .from("organizations")
      .update({ stripe_account_id: stripeAccountId })
      .eq("id", organizationId);

    if (saveError) {
      console.error("[invite-organizer] connect id save failed:", saveError);
      return NextResponse.json(
        { error: "Could not save the organizer's Stripe account." },
        { status: 500 }
      );
    }
  }

  // Defensive: point any existing settlement at the (now known) organization and
  // Stripe account so the payout sweep and the record show who it belongs to.
  // Only legs that have not been paid are touched -- once the organizer share was
  // actually transferred ('sent'), re-pointing the row would mislabel money that
  // already left to the previous organizer. Invites are draft-only, so in the
  // normal flow there is no settlement here; this covers legacy events.
  const { error: settleRefreshError } = await admin
    .from("event_settlements")
    .update({
      organization_id: organizationId,
      organization_stripe_account_id: stripeAccountId,
    })
    .eq("event_id", eventId)
    .in("organizer_status", ["pending", "held"]);
  if (settleRefreshError) {
    console.warn(
      "[invite-organizer] could not refresh the settlement:",
      settleRefreshError
    );
  }

  // The email carries OUR stable, reopenable invite URL -- never the raw Stripe
  // link, which is single-use and expires within minutes. Each visit to it mints
  // a fresh Stripe link, so the organizer can reopen the email as often as they
  // need (and Stripe bounces an abandoned session back to the same URL).
  const onboardingUrl = organizerInviteUrl({ organizationId, eventId });

  // Deliver the invite by email. A failed send is not fatal -- the invite is
  // live either way, so fall back to returning the link for the DJ to pass on.
  const djName = await loadDjName(admin, event.dj_id);
  const delivery = await sendEmail({
    to: email,
    ...organizerInviteEmail({
      organizerName: name,
      djName,
      eventName: event.name,
      onboardingUrl,
    }),
  });
  if (!delivery.ok) {
    console.error("[invite-organizer] could not email the invite:", delivery.error);
  }

  return NextResponse.json({
    ok: true,
    organizationId,
    emailed: delivery.ok,
    // Only handed back when the email did not go out, so the DJ is never shown
    // a link that was already delivered for them.
    onboardingUrl: delivery.ok ? undefined : onboardingUrl,
    emailError: delivery.ok ? undefined : delivery.error,
  });
}

/**
 * The DJ's display name for the email greeting: their act name if set, else the
 * first/last name on their profile.
 */
async function loadDjName(
  admin: ReturnType<typeof getSupabaseAdmin>,
  djId: string
): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("act_name, first_name, last_name")
    .eq("id", djId)
    .maybeSingle();
  const name =
    data?.act_name ||
    [data?.first_name, data?.last_name].filter(Boolean).join(" ");
  return name || "The DJ";
}

/** Current organizer for an event, so the setup page can show invite state. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { eventId } = await params;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: event } = await admin
    .from("events")
    .select("id, dj_id, organization_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.dj_id !== user.id) {
    return NextResponse.json(
      { error: "Only the event owner can view the organizer." },
      { status: 403 }
    );
  }

  if (!event.organization_id) {
    return NextResponse.json({ organizer: null });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, contact_email, status, onboarded_at, stripe_account_id")
    .eq("id", event.organization_id)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ organizer: null });
  }

  // The webhook flips the row, but an organizer who finished before that was
  // wired (or whose event landed mid-flight) would otherwise read as 'invited'
  // forever. Reading the live account here reconciles the row on read. "Ready"
  // means Stripe will fully pay the account (balance + transfers active).
  let ready = false;
  if (org.stripe_account_id) {
    try {
      const status = await fetchDjConnectAccountStatus(org.stripe_account_id);
      ready = status.connected;
    } catch (err) {
      console.warn("[organizers] could not read the connect status:", err);
    }
  }

  const nowIso = new Date().toISOString();
  const onboardedAt = ready ? (org.onboarded_at ?? nowIso) : org.onboarded_at;
  if (ready && org.status !== "onboarded") {
    const { error } = await admin
      .from("organizations")
      .update({ status: "onboarded", onboarded_at: onboardedAt, updated_at: nowIso })
      .eq("id", org.id);
    if (error) console.warn("[organizers] could not mark onboarded:", error);
  }

  const organizer: OrganizerSummary = {
    id: org.id,
    name: org.name,
    email: org.contact_email,
    status: ready ? "onboarded" : org.status,
    onboardedAt,
    hasStripeAccount: Boolean(org.stripe_account_id),
    ready,
  };

  return NextResponse.json({ organizer });
}