import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureStripeFees } from "@/lib/settlement";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/dj/events/[eventId]/finance
 *
 * The settlement preview's numbers. event_finance() splits NET revenue, so the
 * Stripe processing fees for every purchase have to exist first; they are read
 * from Stripe here, before the finance is computed, so the preview shows real
 * fees instead of a one-time $0.00 for purchases that predate fee capture.
 *
 * Fee reading is best-effort on purpose: this route is only a preview. The
 * authoritative backfill happens in settleEvent() when the DJ actually closes
 * the event, and a lookup that transiently fails there is what blocks the close
 * -- here it just leaves the stale number visible.
 *
 * Auth follows /end: only the event's own DJ may view its finances.
 */
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

  const supabase = await getSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("dj_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.dj_id !== user.id) {
    return NextResponse.json(
      { error: "Only the event owner can view this." },
      { status: 403 }
    );
  }

  try {
    await ensureStripeFees(getSupabaseAdmin(), eventId);
  } catch (err) {
    console.error(`[finance] could not refresh fees for ${eventId}:`, err);
  }

  const { data: financeRows, error } = await supabase.rpc("event_finance", {
    p_event_id: eventId,
  });
  if (error || !financeRows?.length) {
    return NextResponse.json({ error: "Could not total this event." }, { status: 500 });
  }

  return NextResponse.json({ finance: financeRows[0] });
}