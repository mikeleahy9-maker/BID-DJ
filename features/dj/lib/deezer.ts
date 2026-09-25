import type { SeedSong } from "@/features/dj/data";

export async function searchDeezerSongs(query: string): Promise<SeedSong[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.tracks ?? []) as SeedSong[];
  } catch {
    return [];
  }
}