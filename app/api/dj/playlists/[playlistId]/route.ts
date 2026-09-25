import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PLAYLIST_ID_RE,
  PLAYLIST_PROJECTION,
  playlistFromRow,
  type PlaylistRow,
} from "@/features/dj/lib/dj-playlists";

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

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can update playlists." },
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

  let body: { name?: unknown; icon?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update: Record<string, string> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: "Please enter a playlist name." },
        { status: 400 }
      );
    }
    update.name = name;
  }
  if (body.icon !== undefined) {
    update.icon = String(body.icon).trim().slice(0, 4) || "🎵";
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("playlists")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", playlistId)
    .select(PLAYLIST_PROJECTION)
    .single();

  if (error) {
    console.error("[update-playlist] failed:", error);
    return NextResponse.json(
      { error: "Could not save the playlist. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    playlist: playlistFromRow(data as unknown as PlaylistRow),
  });
}

export async function DELETE(
  _req: NextRequest,
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
      { error: "Only DJ accounts can delete playlists." },
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

  const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
  if (error) {
    console.error("[delete-playlist] failed:", error);
    return NextResponse.json(
      { error: "Could not delete the playlist. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}