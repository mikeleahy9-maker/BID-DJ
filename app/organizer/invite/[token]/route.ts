import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createOrganizationOnboardingLink } from "@/lib/stripe-connect";
import {
  organizerInviteUrl,
  verifyOrganizerInviteToken,
} from "@/lib/organizer-invite-token";

/**
 * Stable organizer invite entry point.
 *
 * The emailed link points here rather than at Stripe, because a Stripe account
 * link is single-use and expires within minutes. Each visit verifies the signed
 * token and mints a fresh Stripe account link, so the email can be reopened as
 * many times as needed -- and Stripe's own refresh_url bounces back through here
 * too, so an abandoned onboarding session just restarts.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = verifyOrganizerInviteToken(token);
  if (!invite) {
    return new NextResponse("This invite link is not valid.", { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, stripe_account_id")
    .eq("id", invite.organizationId)
    .maybeSingle();

  if (!org?.stripe_account_id) {
    return new NextResponse("This invite is no longer active.", { status: 404 });
  }

  const { data: event } = await admin
    .from("events")
    .select("id, name")
    .eq("id", invite.eventId)
    .maybeSingle();

  try {
    const url = await createOrganizationOnboardingLink({
      accountId: org.stripe_account_id,
      eventId: invite.eventId,
      eventName: event?.name ?? "",
      organizationName: org.name,
      refreshUrl: organizerInviteUrl(invite),
    });
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    console.error("[organizer-invite] could not mint an onboarding link:", err);
    return new NextResponse("Could not start onboarding right now.", {
      status: 502,
    });
  }
}
