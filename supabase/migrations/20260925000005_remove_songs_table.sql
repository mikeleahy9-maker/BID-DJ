-- Remove the Deezer catalog cache (songs table). Nothing reads it anymore:
-- playlists keep full metadata snapshots on playlist_tracks and event_tracks
-- keeps its own columns. The deezer-id columns stay behind (FKs dropped) so
-- the cache can be re-added later (with a backfill) if ever needed.

alter table if exists public.playlist_tracks
  drop constraint if exists playlist_tracks_song_id_fkey;

alter table if exists public.event_tracks
  drop constraint if exists event_tracks_deezer_id_fkey;

drop table if exists public.songs;