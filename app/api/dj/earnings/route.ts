import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * GET /api/dj/earnings?period=week|month|year|all
 *
 * Returns what the DJ actually RECEIVED, per period, with a per-event
 * breakdown of the gigs that happened inside that window.
 *
 * The breakdown is driven by the EVENT's date (when the gig happened), not by
 * when the money moved: "Week" lists the events of the last 7 days, "Month"
 * the last 30, etc. Each event carries the NET amount the DJ received from it
 * -- event_settlements.dj_cents (their 20% of revenue minus their portion of
 * Stripe's processing fee; the figure that lands in their connected account).
 * A leg only counts toward the total when `dj_status = 'sent'`; held/pending/
 * failed legs are shown in the breakdown but never added to it.
 *
 * Songs and guests are the same window: 'played' live-queue requests and
 * attendee rows belonging to those events.
 */
const PERIODS = new Set(["week", "month", "year", "all"]);

const STATUS_LABEL: Record<string, string> = {
  sent: "Settled",
  held: "Processing",
  pending: "Pending",
  failed: "Failed",
};

function periodCutoff(period: string): Date {
  const now = new Date();
  const cutoff = new Date();
  switch (period) {
    case "week":
      cutoff.setDate(now.getDate() - 7);
      break;
    case "month":
      cutoff.setDate(now.getDate() - 30);
      break;
    case "year":
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    default:
      cutoff.setTime(0);
  }
  return cutoff;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? "week";
  if (!PERIODS.has(period)) {
    return NextResponse.json({ error: "Invalid period." }, { status: 400 });
  }
  const cutoff = periodCutoff(period);

  // Pagination for the event breakdown. Totals (hero, gigs, songs, guests)
  // always cover the whole window; only the events list is paged.
  const rawPage = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const rawPageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "10");
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(100, Math.max(1, Math.floor(rawPageSize)))
    : 10;

  const supabase = await getSupabaseServerClient();

  // Gigs in the window: the DJ's ended events whose gig date falls inside it.
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, event_date, status")
    .eq("dj_id", user.id)
    .eq("status", "ended")
    .order("event_date", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }
  const inWindow = ((events ?? []) as Array<{
    id: string;
    name: string;
    event_date: string | null;
  }>).filter((e) => e.event_date && new Date(e.event_date) >= cutoff);

  const eventIds = inWindow.map((e) => e.id);

  // One settlement row per event; none means nothing was ever received for it.
  const settlementByEvent = new Map<
    string,
    { dj_cents: number; dj_status: string; dj_failure_reason: string | null }
  >();
  if (eventIds.length > 0) {
    const { data: settlements, error: settlementsError } = await supabase
      .from("event_settlements")
      .select("event_id, dj_cents, dj_status, dj_failure_reason")
      .eq("dj_id", user.id)
      .in("event_id", eventIds);
    if (settlementsError) {
      return NextResponse.json({ error: settlementsError.message }, { status: 500 });
    }
    for (const row of settlements ?? []) {
      settlementByEvent.set(row.event_id, row);
    }
  }

  // Songs actually played (the live queue's terminal 'played' state) and
  // guests (one attendees row per guest) for the same window's events.
  let songsByEvent = new Map<string, number>();
  let guestsByEvent = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: played } = await supabase
      .from("requests")
      .select("event_id, id")
      .in("event_id", eventIds)
      .eq("status", "played");
    songsByEvent = new Map<string, number>();
    for (const song of played ?? []) {
      songsByEvent.set(song.event_id, (songsByEvent.get(song.event_id) ?? 0) + 1);
    }

    const { data: attendees } = await supabase
      .from("attendees")
      .select("event_id, id")
      .in("event_id", eventIds);
    guestsByEvent = new Map<string, number>();
    for (const attendee of attendees ?? []) {
      guestsByEvent.set(
        attendee.event_id,
        (guestsByEvent.get(attendee.event_id) ?? 0) + 1
      );
    }
  }

  let total = 0;
  let songs = 0;
  let guests = 0;
  const breakdown = inWindow.map((event) => {
    const settlement = settlementByEvent.get(event.id);
    const djStatus = settlement?.dj_status ?? "pending";
    const songCount = songsByEvent.get(event.id) ?? 0;
    const guestCount = guestsByEvent.get(event.id) ?? 0;
    songs += songCount;
    guests += guestCount;
    if (djStatus === "sent") {
      // dj_cents is NET of the DJ's Stripe fees; no rounding because each leg
      // was already floored on the integer amount Stripe moved.
      if (settlement) total += settlement.dj_cents;
    }
    return {
      name: event.name,
      date: new Date(event.event_date as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      earned: djStatus === "sent" && settlement ? settlement.dj_cents / 100 : 0,
      status: STATUS_LABEL[djStatus] ?? djStatus,
      reason: settlement?.dj_failure_reason ?? null,
      songs: songCount,
      guests: guestCount,
    };
  });

  return NextResponse.json({
    period,
    // cents -> dollars: the panel renders money, not cents
    total: total / 100,
    gigs: breakdown.length,
    songs,
    guests,
    page,
    pageSize,
    totalEvents: breakdown.length,
    events: breakdown.slice((page - 1) * pageSize, page * pageSize),
  });
}