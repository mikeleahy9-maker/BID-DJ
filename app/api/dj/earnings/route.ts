import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * GET /api/dj/earnings
 *
 * Returns earnings data for the current DJ across different periods.
 * Computes totals from tips on completed events.
 * DJ share is 20% (payout_rate defaults to 0.200).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") ?? "week";

  // Get DJ's events that have ended (completed)
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, event_date, payout_rate, status")
    .eq("dj_id", user.id)
    .eq("status", "ended")
    .order("event_date", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) {
    return NextResponse.json({
      period,
      total: 0,
      gigs: 0,
      songs: 0,
      guests: 0,
      events: [],
      payouts: [],
    });
  }

  // Get tips for these events
  const { data: tips, error: tipsError } = await supabase
    .from("tips")
    .select("event_id, amount_cents")
    .in("event_id", eventIds)
    .eq("status", "released");

  if (tipsError) {
    return NextResponse.json({ error: tipsError.message }, { status: 500 });
  }

  // Sum tips per event
  const tipsByEvent = new Map<string, number>();
  for (const tip of tips ?? []) {
    const current = tipsByEvent.get(tip.event_id) ?? 0;
    tipsByEvent.set(tip.event_id, current + tip.amount_cents);
  }

  // Filter by period
  const now = new Date();
  const cutoff = new Date();
  switch (period) {
    case "week":
      cutoff.setDate(now.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
    default:
      cutoff.setTime(0);
  }

  const DJ_PCT = 0.2;
  const eventsWithEarnings = (events ?? [])
    .filter((e) => e.event_date && new Date(e.event_date) >= cutoff)
    .map((e) => {
      const tipsCents = tipsByEvent.get(e.id) ?? 0;
      const payoutRate = e.payout_rate ?? DJ_PCT;
      return {
        name: e.name,
        date: e.event_date
          ? new Date(e.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "TBD",
        earned: Math.round(tipsCents * payoutRate) / 100,
        songs: 0,
      };
    });

  const total = eventsWithEarnings.reduce((sum, e) => sum + e.earned, 0);

  // Get payout history
  const { data: payouts } = await supabase
    .from("dj_payouts")
    .select("id, amount_cents, status, created_at, paid_at")
    .eq("dj_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    period,
    total,
    gigs: eventsWithEarnings.length,
    songs: 0, // Would need requests table
    guests: 0, // Would need attendees table
    events: eventsWithEarnings,
    payouts: (payouts ?? []).map((p) => ({
      id: p.id,
      amount: p.amount_cents / 100,
      status: p.status,
      created_at: p.created_at,
      paid_at: p.paid_at,
    })),
  });
}