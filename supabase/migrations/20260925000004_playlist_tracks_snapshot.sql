-- Snapshot song metadata onto playlist_tracks so playlists render songs
-- without relying on the catalog join. Backfill existing rows from songs.

alter table public.playlist_tracks
  add column if not exists song_title text;

alter table public.playlist_tracks
  add column if not exists song_artist text;

alter table public.playlist_tracks
  add column if not exists song_cover text;

alter table public.playlist_tracks
  add column if not exists song_duration int;

update public.playlist_tracks pt
set song_title = s.title,
    song_artist = s.artist,
    song_cover = s.cover_medium,
    song_duration = s.duration
from public.songs s
where pt.song_id = s.deezer_id
  and pt.song_title is null;