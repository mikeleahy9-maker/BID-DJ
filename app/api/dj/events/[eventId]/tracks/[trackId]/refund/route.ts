import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { notifyRefundedGuests } from "@/lib/refund-notifications";

/**
 * DJ-side refund of a queued song.
 *
 * The DJ used to call refund_track straight from the browser, which meant the
 * refund ran without any server context and no confirmation email could be
 * sent. Routing it through here keeps the same RPC (and its RLS/is_event_dj
 * guard) but snapshots the bidders before the cascade deletes them, so every
 * refunded guest can be emailed.
 */
interface RouteProps {
  params: Promise<{ eventId: string; trackId: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteProps) {
  const { eventId, trackId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(trackId)) {
    return NextResponse.json({ error: "Invalid song." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, dj_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || (event as { dj_id: string }).dj_id !== user.id) {
    return NextResponse.json({ error: "Only the event owner can refund songs." }, { status: 403 });
  }

  const { data: track, error: trackError } = await supabase
    .from("event_tracks")
    .select("id, event_id, status, title, artist")
    .eq("id", trackId)
    .maybeSingle();
  if (trackError || !track || track.event_id !== eventId) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }
  if (track.status === "played") {
    return NextResponse.json({ error: "already_played" }, { status: 400 });
  }

  // Snapshot each guest's stake before the refund deletes the bids, so the
  // emails can name who is owed what after the rows are gone.
  const { data: rows, error: bidsError } = await supabase
    .from("bids")
    .select("amount, user_id")
    .eq("track_id", trackId);
  if (bidsError) throw bidsError;

  const perUser = new Map<string, number>();
  for (const r of (rows ?? []) as { amount: number | null; user_id: string }[]) {
    perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + Number(r.amount ?? 0));
  }

  const { data, error } = await supabase.rpc("refund_track", {
    p_track_id: trackId,
  });
  if (error) {
    console.error("[dj refund] rpc failed:", error);
    return NextResponse.json(
      { error: "Could not refund the song. Please try again." },
      { status: 500 }
    );
  }

  const row = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    refunded?: number;
    holders?: number;
  };
  if (!row.ok) {
    return NextResponse.json(
      { error: row.error ?? "refund_failed" },
      { status: 400 }
    );
  }

  await notifyRefundedGuests({
    eventId,
    trackTitle: track.title,
    trackArtist: track.artist,
    perUser,
  });

  return NextResponse.json({
    ok: true,
    refunded: row.refunded ?? 0,
    holders: row.holders ?? 0,
    track_id: trackId,
  });
}
