-- PostgREST upsert needs a real unique constraint (not a partial unique
-- index) matching the on_conflict target. Swap the partial index for a
-- constraint; NULL deezer_ids (legacy rows) never collide under a UNIQUE
-- constraint, so seeding behavior is unchanged.

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