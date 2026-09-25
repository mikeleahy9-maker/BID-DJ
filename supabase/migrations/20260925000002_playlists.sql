-- ============================================================================
-- PLAY LISTS — DJ-owned collections of songs (from the Deezer catalog), used
-- to seed events. playlist_tracks joins a playlist to catalog songs.
-- ============================================================================

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text not null default '🎵',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id bigint not null references public.songs(deezer_id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, song_id)
);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

-- Playlists: only the owning DJ.
drop policy if exists "playlists_select_own" on public.playlists;
create policy "playlists_select_own" on public.playlists
  for select using (dj_id = auth.uid());

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own" on public.playlists
  for insert with check (dj_id = auth.uid());

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own" on public.playlists
  for update using (dj_id = auth.uid()) with check (dj_id = auth.uid());

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own" on public.playlists
  for delete using (dj_id = auth.uid());

-- Playlist tracks: reachable only through a playlist the DJ owns.
drop policy if exists "playlist_tracks_select_own" on public.playlist_tracks;
create policy "playlist_tracks_select_own" on public.playlist_tracks
  for select using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.dj_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_insert_own" on public.playlist_tracks;
create policy "playlist_tracks_insert_own" on public.playlist_tracks
  for insert with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.dj_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_update_own" on public.playlist_tracks;
create policy "playlist_tracks_update_own" on public.playlist_tracks
  for update using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.dj_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_delete_own" on public.playlist_tracks;
create policy "playlist_tracks_delete_own" on public.playlist_tracks
  for delete using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.dj_id = auth.uid()
    )
  );