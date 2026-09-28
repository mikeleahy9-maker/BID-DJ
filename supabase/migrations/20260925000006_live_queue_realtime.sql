-- Live queue: realtime for the board + approvals inbox, and the schema to
-- support the DJ approve/reject flow (approve copies a request into
-- event_tracks). Guests of a live event can now read the board too.

-- Realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_tracks'
  ) then
    alter publication supabase_realtime add table public.event_tracks;
  end if;
end $$;

-- Requests: carry the Deezer row for direct copy into event_tracks on approve,
-- plus the requested bid amount and an explicit rejected status.
alter table public.requests
  add column if not exists deezer_id bigint,
  add column if not exists cover_url text,
  add column if not exists credits numeric(10,2) not null default 0;

alter table public.requests
  drop constraint if exists requests_status_check;

alter table public.requests
  add constraint requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'playing', 'played', 'skipped'));

-- The board song lifecycle: seeded/approved songs queue up, go live, then pass.
alter table public.event_tracks
  add column if not exists status text not null default 'queued'
    check (status in ('queued', 'playing', 'played'));

-- Guests of a live event may read the board (DJ access is covered by
-- is_event_dj via event_tracks_select).
drop policy if exists "event_tracks_select_live" on public.event_tracks;
create policy "event_tracks_select_live" on public.event_tracks
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_tracks.event_id and e.status = 'live'
    )
  );