import type { SeedSong } from "@/features/dj/data";

export interface SongSearchResult {
  tracks: SeedSong[];
  total: number;
  nextIndex: number;
  hasMore: boolean;
}

export async function searchDeezerSongs(
  query: string,
  index = 0
): Promise<SongSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { tracks: [], total: 0, nextIndex: 0, hasMore: false };
  try {
    const res = await fetch(
      `/api/songs/search?q=${encodeURIComponent(q)}&index=${index}`
    );
    if (!res.ok) return { tracks: [], total: 0, nextIndex: 0, hasMore: false };
    const data = await res.json().catch(() => ({}));
    return {
      tracks: (data.tracks ?? []) as SeedSong[],
      total: Number(data.total ?? 0),
      nextIndex: Number(data.nextIndex ?? 0),
      hasMore: Boolean(data.hasMore),
    };
  } catch {
    return { tracks: [], total: 0, nextIndex: 0, hasMore: false };
  }
}