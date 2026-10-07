import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { settleEvent } from "@/lib/settlement";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/dj/events/[eventId]/end
 *
 * Ends a live event by BOOKING its settlement, not by moving money: totals the
 * event's credit purchases, splits the net revenue 70/20/10 (read from
 * event_finance(), never from the client), records the per-party amounts and
 * fees, then marks the event ended and closes it. The shares are transferred
 * later, once Stripe settles the charges into the platform's available
 * balance -- see retryOutstandingSettlements(), triggered by the
 * balance.available webhook and the /api/cron/settle sweep.
 *
 * Safe to call twice: settleEvent() is keyed on the event's settlement row, so
 * a retry after a dropped response returns the recorded result instead of
 * booking or paying anything a second time.
 */
export async function POST(
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

  const result = await settleEvent(eventId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }

  return NextResponse.json({ ok: true, settlement: result.summary });
}
