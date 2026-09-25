import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { PLAYLIST_ID_RE } from "@/features/dj/lib/dj-playlists";

interface TrackPayload {
  deezerId?: unknown;
  title?: unknown;
  artist?: unknown;
  image?: unknown;
  durationSec?: unknown;
  credits?: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { playlistId } = await params;
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can edit playlists." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  }

  let body: TrackPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const deezerId = Number(body.deezerId);
  if (!Number.isInteger(deezerId) || deezerId <= 0) {
    return NextResponse.json({ error: "Invalid song id." }, { status: 400 });
  }
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Invalid song title." }, { status: 400 });
  }
  const artist = String(body.artist ?? "").trim() || "Unknown artist";
  const image = body.image ? String(body.image) : null;
  const duration = Number(body.durationSec) > 0 ? Number(body.durationSec) : null;
  const credits = Math.max(0, Number(body.credits ?? 5) || 5);

  const { data: already } = await supabase
    .from("playlist_tracks")
    .select("id")
    .eq("playlist_id", playlistId)
    .eq("song_id", deezerId)
    .maybeSingle();
  if (already) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { data: posRows } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (Number(posRows?.[0]?.position) || 0) + 1;

  const { error } = await supabase.from("playlist_tracks").insert({
    playlist_id: playlistId,
    song_id: deezerId,
    position,
    credits,
    song_title: title,
    song_artist: artist,
    song_cover: image,
    song_duration: duration,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    console.error("[add-playlist-track] failed:", error);
    return NextResponse.json(
      { error: "Could not add the song. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, already: false });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { playlistId } = await params;
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const songId = Number(searchParams.get("deezerId"));
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid song id." }, { status: 400 });
  }

  let body: { credits?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const credits = Number(body.credits);
  if (!Number.isFinite(credits) || credits < 0 || credits > 1000) {
    return NextResponse.json(
      { error: "Invalid credits value." },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can edit playlists." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("playlist_tracks")
    .update({ credits })
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);

  if (error) {
    console.error("[update-playlist-track] failed:", error);
    return NextResponse.json(
      { error: "Could not update the song. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, credits });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { playlistId } = await params;
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const deezerIdParam = searchParams.get("deezerId");
  const songId = Number(deezerIdParam);
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid song id." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can edit playlists." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);

  if (error) {
    console.error("[remove-playlist-track] failed:", error);
    return NextResponse.json(
      { error: "Could not remove the song. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}