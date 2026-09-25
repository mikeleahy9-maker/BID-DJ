import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedPlaylist, SeedSong } from "@/features/dj/data";

export const PLAYLIST_PROJECTION =
  "id, dj_id, name, icon, created_at, updated_at";

export const PLAYLIST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlaylistRow {
  id: string;
  dj_id: string;
  name: string;
  icon: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PlaylistTrackRow {
  playlist_id: string;
  song_id: number;
  position: number;
  credits?: number | null;
  song_title?: string | null;
  song_artist?: string | null;
  song_cover?: string | null;
  song_duration?: number | null;
}

export function playlistFromRow(
  row: PlaylistRow,
  songs: SeedSong[] = []
): SavedPlaylist {
  return { id: row.id, name: row.name, icon: row.icon, songs };
}

export function songsFromTrackRows(rows: PlaylistTrackRow[]): SeedSong[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((t) => {
      const title = t.song_title;
      if (!title || !t.song_id) return [];
      return [
        {
          id: String(t.song_id),
          deezerId: t.song_id,
          title,
          artist: t.song_artist ?? "Unknown artist",
          image: t.song_cover ?? null,
          durationSec: t.song_duration ?? null,
          credits: Number(t.credits ?? 5),
        } satisfies SeedSong,
      ];
    });
}

export async function getDjPlaylists(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedPlaylist[]> {
  const { data: rows } = await supabase
    .from("playlists")
    .select(PLAYLIST_PROJECTION)
    .eq("dj_id", userId)
    .order("created_at", { ascending: false });

  const playlists = (rows ?? []) as unknown as PlaylistRow[];
  const ids = playlists.map((p) => p.id);

  const songsByPlaylist = new Map<string, PlaylistTrackRow[]>();
  if (ids.length > 0) {
    const { data: trackRows } = await supabase
      .from("playlist_tracks")
      .select(
        "playlist_id, song_id, position, credits, song_title, song_artist, song_cover, song_duration"
      )
      .in("playlist_id", ids)
      .order("position", { ascending: true });

    for (const t of (trackRows ?? []) as unknown as PlaylistTrackRow[]) {
      const list = songsByPlaylist.get(t.playlist_id) ?? [];
      list.push(t);
      songsByPlaylist.set(t.playlist_id, list);
    }
  }

  return playlists.map((p) =>
    playlistFromRow(p, songsFromTrackRows(songsByPlaylist.get(p.id) ?? []))
  );
}