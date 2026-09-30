import { NextRequest, NextResponse } from "next/server";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Helper queue: approve a pending song request.
 *
 * A helper holds an HMAC cookie, not a Supabase session, so auth.uid() is null
 * in the browser and the RLS-gated requests update / event_tracks insert are
 * denied there. This route authenticates from the cookie and re-implements the
 * DJ approve flow with the admin client, scoped to the session's event.
 */
export async function POST(req: NextRequest) {
  const helper = await readHelperSession();
  if (!helper) {
    return NextResponse.json({ error: "Not in helper mode." }, { status: 401 });
  }

  let body: { requestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("id, event_id, song_title, song_artist, credits, deezer_id, cover_url, status")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError || !request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (request.event_id !== helper.eventId) {
      return NextResponse.json({ error: "Request not in this event." }, { status: 403 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ error: "Request already handled." }, { status: 400 });
    }

    let existingId: string | null = null;
    if (request.deezer_id) {
      const { data } = await supabase
        .from("event_tracks")
        .select("id")
        .eq("event_id", helper.eventId)
        .eq("deezer_id", request.deezer_id)
        .maybeSingle();
      existingId = (data as { id: string } | null)?.id ?? null;
    } else {
      const { data } = await supabase
        .from("event_tracks")
        .select("id")
        .eq("event_id", helper.eventId)
        .ilike("title", request.song_title ?? "")
        .limit(1);
      existingId = (data as { id: string }[] | null)?.[0]?.id ?? null;
    }

    if (!existingId) {
      const { error } = await supabase.from("event_tracks").insert({
        event_id: helper.eventId,
        title: request.song_title,
        artist: request.song_artist ?? "Unknown artist",
        credits: Number(request.credits) > 0 ? Number(request.credits) : 5,
        deezer_id: request.deezer_id,
        cover_url: request.cover_url,
        status: "queued",
      });
      if (error) {
        console.error("[helper approve] track insert failed:", error);
        return NextResponse.json(
          { error: "Could not add the song to the queue." },
          { status: 500 }
        );
      }
    }

    const { error } = await supabase
      .from("requests")
      .update({ status: "approved" })
      .eq("id", requestId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[helper approve] failed:", err);
    return NextResponse.json(
      { error: "Could not approve the request. Please try again." },
      { status: 500 }
    );
  }
}