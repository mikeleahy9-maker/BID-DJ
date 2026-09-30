import { NextRequest, NextResponse } from "next/server";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const helper = await readHelperSession();
  if (!helper) {
    return NextResponse.json({ error: "Not in helper mode." }, { status: 401 });
  }

  let payload: {
    title?: unknown;
    artist?: unknown;
    credits?: unknown;
    deezerId?: unknown;
    image?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = String(payload?.title ?? "").trim();
  const artist = String(payload?.artist ?? "").trim();
  if (!title || !artist) {
    return NextResponse.json({ error: "A title and artist are required." }, { status: 400 });
  }

  const credits = Math.max(0, Number(payload?.credits ?? 5) || 5);
  const deezerId = payload?.deezerId ? Number(payload.deezerId) : null;
  const coverUrl = payload?.image ? String(payload.image) : null;

  try {
    const supabase = getSupabaseAdmin();
    const row = {
      event_id: helper.eventId,
      deezer_id: deezerId,
      title,
      artist,
      credits,
      cover_url: coverUrl,
    };

    const query = supabase.from("event_tracks");
    const result = deezerId
      ? await query
          .upsert(row, { onConflict: "event_id,deezer_id" })
          .select("id, event_id, title, artist, credits, deezer_id, cover_url")
          .single()
      : await query.insert(row).select("id, event_id, title, artist, credits, deezer_id, cover_url").single();

    if (result.error) {
      const code = (result.error as { code?: string } | null)?.code;
      if (code === "23505") {
        return NextResponse.json({ ok: true, track: null, already: true });
      }
      console.error("[helper seed] insert failed:", result.error);
      return NextResponse.json(
        { error: "Could not seed the song. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, track: result.data });
  } catch (err) {
    console.error("[helper seed] failed:", err);
    return NextResponse.json(
      { error: "Could not seed the song. Please try again." },
      { status: 500 }
    );
  }
}