import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

const DEEZER_SEARCH = "https://api.deezer.com/search";

interface DeezerTrack {
  id: number;
  title: string;
  artist?: { name?: string };
  album?: { cover_medium?: string };
  duration?: number;
}

function toTrack(t: DeezerTrack) {
  return {
    id: String(t.id),
    deezerId: t.id,
    title: t.title ?? "Unknown",
    artist: t.artist?.name ?? "Unknown artist",
    image: t.album?.cover_medium ?? null,
    durationSec: t.duration ?? null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  let json: { data?: DeezerTrack[] };
  try {
    const res = await fetch(
      `${DEEZER_SEARCH}?q=${encodeURIComponent(q)}&limit=10`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`Deezer responded ${res.status}`);
    json = await res.json();
  } catch (err) {
    console.error("[songs/search] Deezer request failed:", err);
    return NextResponse.json(
      { tracks: [], error: "Could not reach Deezer." },
      { status: 502 }
    );
  }

  const tracks = (json.data ?? []).map(toTrack);

  return NextResponse.json({ tracks });
}