-- ----------------------------------------------------------------------------
-- Deezer integration: song catalog cache + event seed tracks.
-- ----------------------------------------------------------------------------

-- Global Deezer catalog cache (searched via a server proxy, upserted by id).
create table if not exists public.songs (
  deezer_id bigint primary key,
  title text not null,
  artist text not null,
  album text,
  duration int,
  cover_small text,
  cover_medium text,
  cover_big text,
  popularity int,
  deezer_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.songs enable row level security;

drop policy if exists "songs_select_any" on public.songs;
create policy "songs_select_any" on public.songs
  for select using (true);

drop policy if exists "songs_insert_any" on public.songs;
create policy "songs_insert_any" on public.songs
  for insert with check (true);

drop policy if exists "songs_update_any" on public.songs;
create policy "songs_update_any" on public.songs
  for update using (true) with check (true);

-- Seed tracks: a song (with snapshot metadata) + starter credits for an event.
alter table public.event_tracks
  add column if not exists deezer_id bigint references public.songs(deezer_id) on delete set null;
alter table public.event_tracks
  add column if not exists credits numeric(10,2) not null default 5;
alter table public.event_tracks
  add column if not exists cover_url text;

drop index if exists event_tracks_event_song_unique_idx;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_tracks_event_song_unique'
      and conrelid = 'public.event_tracks'::regclass
  ) then
    alter table public.event_tracks
      add constraint event_tracks_event_song_unique unique (event_id, deezer_id);
  end if;
end $$;

-- The event's DJ manages its seed list (select/insert already exist).
drop policy if exists "event_tracks_update_dj" on public.event_tracks;
create policy "event_tracks_update_dj" on public.event_tracks
  for update using (public.is_event_dj(event_id))
  with check (public.is_event_dj(event_id));

drop policy if exists "event_tracks_delete_dj" on public.event_tracks;
create policy "event_tracks_delete_dj" on public.event_tracks
  for delete using (public.is_event_dj(event_id));