import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createOrganizationConnectAccount,
  createOrganizationOnboardingLink,
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
}

/**
 * Invites (or re-invites) the organizer for an event and returns the Stripe
 * onboarding URL for them.
 *
 * TEMPORARY: SendGrid is not configured yet, so the onboarding URL is returned
 * to the caller for manual delivery instead of being emailed. When the SendGrid
 * key lands, replace the `return NextResponse.json({ onboardingUrl })` tail with
 * an email send and stop returning the URL.
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
    .select("id, name, dj_id")
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

  // This event may already be settled: a DJ can close a night without having
  // invited the organizer and link one afterwards. Point any existing
  // settlement at the (now known) organization and Stripe account so the payout
  // sweeps to the right place and the record shows who it belongs to. Failing
  // here is not fatal -- the sweep re-resolves the live link on its own.
  const { error: settleRefreshError } = await admin
    .from("event_settlements")
    .update({
      organization_id: organizationId,
      organization_stripe_account_id: stripeAccountId,
    })
    .eq("event_id", eventId);
  if (settleRefreshError) {
    console.warn(
      "[invite-organizer] could not refresh the settlement:",
      settleRefreshError
    );
  }

  let onboardingUrl: string;
  try {
    onboardingUrl = await createOrganizationOnboardingLink({
      accountId: stripeAccountId,
      eventId,
      eventName: event.name,
      organizationName: name,
    });
  } catch (err) {
    console.error("[invite-organizer] onboarding link failed:", err);
    return NextResponse.json(
      { error: "Could not create the organizon's onboarding link." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    organizationId,
    onboardingUrl,
  });
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

  const organizer: OrganizerSummary = {
    id: org.id,
    name: org.name,
    email: org.contact_email,
    status: org.status,
    onboardedAt: org.onboarded_at,
    hasStripeAccount: Boolean(org.stripe_account_id),
  };

  return NextResponse.json({ organizer });
}