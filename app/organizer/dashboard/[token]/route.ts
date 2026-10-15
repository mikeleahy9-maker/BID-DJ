import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createExpressDashboardLoginLink } from "@/lib/stripe-connect";
import { verifyOrganizerDashboardToken } from "@/lib/organizer-dashboard-token";

/**
 * Stable organizer payout-dashboard entry point.
 *
 * The emailed link points here rather than at Stripe, because a Stripe login
 * link is single-use and expires within minutes. The query string carries a
 * signed, per-organizer token; each visit verifies it, resolves the
 * organization's Stripe Express account, mints a FRESH login link and redirects
 * the organizer into their dashboard.
 *
 * The organizer never logs into BidaBeat: Stripe itself authenticates them with
 * a code sent to the account's email or phone. The token only grants "open this
 * organization's dashboard", which is why a short HMAC over the organization id
 * is sufficient and no session is involved.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const claim = verifyOrganizerDashboardToken(token);
  if (!claim) {
    return new NextResponse("This payout link is not valid.", { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("id, stripe_account_id")
    .eq("id", claim.organizationId)
    .maybeSingle();

  if (!org?.stripe_account_id) {
    return new NextResponse("This organizer has no payout account yet.", {
      status: 404,
    });
  }

  try {
    const url = await createExpressDashboardLoginLink(org.stripe_account_id);
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    console.error("[organizer-dashboard] could not mint a login link:", err);
    return new NextResponse("Could not open the payout dashboard right now.", {
      status: 502,
    });
  }
}
