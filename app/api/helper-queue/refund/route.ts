import { NextRequest, NextResponse } from "next/server";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Helper queue actions for a track, pinned to the helper session's event.
 *
 * GET  ?trackId=  -> { total, holders } stake the modal shows before refunding.
 * POST {trackId}  -> refunds the song and returns { refunded, holders }.
 *
 * Helpers hold an HMAC cookie, not a Supabase session, so auth.uid() is null in
 * the browser and the RLS-gated refund_track RPC / bids read are denied there.
 * This route authenticates from the cookie and re-implements refund_track with
 * the admin client, scoped to the session's event.
 */
export async function GET(req: NextRequest) {
  const helper = await readHelperSession();
  if (!helper) {
    return NextResponse.json({ error: "Not in helper mode." }, { status: 401 });
  }

  const trackId = String(new URL(req.url).searchParams.get("trackId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(trackId)) {
    return NextResponse.json({ error: "Invalid song." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: track, error: trackError } = await supabase
      .from("event_tracks")
      .select("id, event_id")
      .eq("id", trackId)
      .maybeSingle();
    if (trackError || !track) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (track.event_id !== helper.eventId) {
      return NextResponse.json({ error: "Song not in this event." }, { status: 403 });
    }

    const { data: rows, error: bidsError } = await supabase
      .from("bids")
      .select("amount, user_id")
      .eq("track_id", trackId);
    if (bidsError) throw bidsError;
    const bids = (rows ?? []) as { amount: number | null; user_id: string }[];
    const total = bids.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    const holders = new Set(bids.map((r) => r.user_id)).size;

    return NextResponse.json({ total, holders });
  } catch (err) {
    console.error("[helper refund] stake failed:", err);
    return NextResponse.json(
      { error: "Could not load the song's stake." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const helper = await readHelperSession();
  if (!helper) {
    return NextResponse.json({ error: "Not in helper mode." }, { status: 401 });
  }

  let body: { trackId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const trackId = String(body?.trackId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(trackId)) {
    return NextResponse.json({ error: "Invalid song." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: track, error: trackError } = await supabase
      .from("event_tracks")
      .select("id, event_id, status")
      .eq("id", trackId)
      .maybeSingle();
    if (trackError || !track) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (track.event_id !== helper.eventId) {
      return NextResponse.json({ error: "Song not in this event." }, { status: 403 });
    }
    if (track.status === "played") {
      return NextResponse.json({ error: "already_played" }, { status: 400 });
    }

    const { data: rows, error: bidsError } = await supabase
      .from("bids")
      .select("amount, user_id")
      .eq("track_id", trackId);
    if (bidsError) throw bidsError;
    const bids = (rows ?? []) as { amount: number | null; user_id: string }[];

    const perUser = new Map<string, number>();
    for (const r of bids) {
      perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + Number(r.amount ?? 0));
    }
    const total = [...perUser.values()].reduce((s, v) => s + v, 0);
    const holders = perUser.size;

    for (const [userId, amount] of perUser) {
      const { data: attendee } = await supabase
        .from("attendees")
        .select("credit_balance")
        .eq("event_id", helper.eventId)
        .eq("user_id", userId)
        .maybeSingle();
      const current = Number(attendee?.credit_balance ?? 0);
      const { error: attendeeError } = await supabase
        .from("attendees")
        .update({ credit_balance: current + amount })
        .eq("event_id", helper.eventId)
        .eq("user_id", userId);
      if (attendeeError) throw attendeeError;
    }

    const { error: deleteError } = await supabase
      .from("event_tracks")
      .delete()
      .eq("id", trackId);
    if (deleteError) throw deleteError;

    return NextResponse.json({
      ok: true,
      refunded: total,
      holders,
      track_id: trackId,
    });
  } catch (err) {
    console.error("[helper refund] failed:", err);
    return NextResponse.json(
      { error: "Could not refund the song. Please try again." },
      { status: 500 }
    );
  }
}