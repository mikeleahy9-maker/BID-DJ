import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";

const TRACK_SELECT = "id, event_id, title, artist, credits, deezer_id, cover_url";

interface RouteProps {
  params: Promise<{ eventId: string }>;
}

interface TrackPayload {
  title?: string;
  artist?: string;
  credits?: number;
  deezerId?: number | null;
  image?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, dj_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || (event as { dj_id: string }).dj_id !== user.id) {
    return NextResponse.json({ error: "Only the event owner can seed songs." }, { status: 403 });
  }

  let payload: TrackPayload;
  try {
    payload = (await req.json()) as TrackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = String(payload.title ?? "").trim();
  const artist = String(payload.artist ?? "").trim();
  if (!title || !artist) {
    return NextResponse.json({ error: "A title and artist are required." }, { status: 400 });
  }

  const credits = Math.max(0, Number(payload.credits ?? 5) || 5);
  const deezerId = payload.deezerId ? Number(payload.deezerId) : null;
  const coverUrl = payload.image || null;

  const row = {
    event_id: eventId,
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
        .select(TRACK_SELECT)
        .single()
    : await query.insert(row).select(TRACK_SELECT).single();

  if (result.error || !result.data) {
    const code = (result.error as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json({ ok: true, track: null, already: true });
    }
    console.error("[tracks] insert failed:", result.error);
    return NextResponse.json(
      { error: "Could not seed the song. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, track: result.data });
}

export async function DELETE(req: NextRequest, { params }: RouteProps) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, dj_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || (event as { dj_id: string }).dj_id !== user.id) {
    return NextResponse.json({ error: "Only the event owner can remove seed songs." }, { status: 403 });
  }

  const deezerIdParam = new URL(req.url).searchParams.get("deezerId");
  if (!deezerIdParam) {
    return NextResponse.json({ error: "Missing song." }, { status: 400 });
  }

  const { error } = await supabase
    .from("event_tracks")
    .delete()
    .eq("event_id", eventId)
    .eq("deezer_id", Number(deezerIdParam));

  if (error) {
    console.error("[tracks] delete failed:", error);
    return NextResponse.json(
      { error: "Could not remove the seed song. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}