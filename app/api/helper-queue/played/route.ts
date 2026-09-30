import { NextRequest, NextResponse } from "next/server";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
      .select("id, event_id")
      .eq("id", trackId)
      .maybeSingle();
    if (trackError || !track) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (track.event_id !== helper.eventId) {
      return NextResponse.json({ error: "Song not in this event." }, { status: 403 });
    }

    const { error } = await supabase
      .from("event_tracks")
      .update({ status: "played" })
      .eq("id", trackId);
    if (error) {
      console.error("[helper played] update failed:", error);
      return NextResponse.json(
        { error: "Could not mark the song as played." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[helper played] failed:", err);
    return NextResponse.json(
      { error: "Could not update the song. Please try again." },
      { status: 500 }
    );
  }
}