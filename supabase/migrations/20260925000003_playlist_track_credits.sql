-- Credits per playlist track: defaults to the seed budget and is persisted
-- so "Load →" into an event seed list carries the DJ's chosen 💎 value.

alter table public.playlist_tracks
  add column if not exists credits numeric(10,2) not null default 5;