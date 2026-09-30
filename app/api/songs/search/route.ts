import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { readHelperSession } from "@/lib/helper-session";

const DEEZER_SEARCH = "https://api.deezer.com/search";
const PAGE_SIZE = 10;

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
  const [user, helper] = await Promise.all([getCurrentUser(), readHelperSession()]);
  if (!user && !helper) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ tracks: [], total: 0 });
  }

  const index = Math.max(
    0,
    Number.parseInt(req.nextUrl.searchParams.get("index") ?? "0", 10) || 0
  );

  let json: { data?: DeezerTrack[]; total?: number };
  try {
    const res = await fetch(
      `${DEEZER_SEARCH}?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&index=${index}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`Deezer responded ${res.status}`);
    json = await res.json();
  } catch (err) {
    console.error("[songs/search] Deezer request failed:", err);
    return NextResponse.json(
      { tracks: [], total: 0, error: "Could not reach Deezer." },
      { status: 502 }
    );
  }

  const tracks = (json.data ?? []).map(toTrack);
  const count = json.data?.length ?? 0;
  const nextIndex = index + count;

  return NextResponse.json({
    tracks,
    total: Number(json.total ?? 0),
    nextIndex,
    hasMore: count > 0 && nextIndex < Number(json.total ?? 0),
  });
}