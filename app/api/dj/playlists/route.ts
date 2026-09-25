import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PLAYLIST_PROJECTION,
  getDjPlaylists,
  playlistFromRow,
  type PlaylistRow,
} from "@/features/dj/lib/dj-playlists";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can manage playlists." },
      { status: 403 }
    );
  }

  const playlists = await getDjPlaylists(supabase, user.id);
  return NextResponse.json({ ok: true, playlists });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can create playlists." },
      { status: 403 }
    );
  }

  let body: { name?: unknown; icon?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Please enter a playlist name." },
      { status: 400 }
    );
  }
  const icon = String(body?.icon ?? "🎵").trim().slice(0, 4) || "🎵";

  const { data, error } = await supabase
    .from("playlists")
    .insert({ dj_id: user.id, name, icon })
    .select(PLAYLIST_PROJECTION)
    .single();

  if (error) {
    console.error("[create-playlist] failed:", error);
    return NextResponse.json(
      { error: "Could not create the playlist. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    playlist: playlistFromRow(data as unknown as PlaylistRow),
  });
}