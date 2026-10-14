-- ----------------------------------------------------------------------------
-- Guest dashboard "Songs Bid" now counts every song the guest put credits on.
--
-- It counted only `requests` rows, so a guest who bid up/down existing queued
-- songs (the `bids` ledger) but never requested one saw "Songs Bid" = 0 even
-- though they clearly bid. A "song bid" is any song the guest committed credits
-- to: a request (requests.credits) or a stake on a queued track (bids.amount).
--
-- Both sources fold into one set keyed by song identity -- the Deezer id when
-- present, otherwise "title|artist" lowercased -- counted distinct per
-- (event, user). A song the guest requested and later also bid on is therefore
-- counted once, not twice. Rejected requests are excluded, matching `spent`.
-- ----------------------------------------------------------------------------
create or replace function public.guest_my_events()
returns table (
  event_id uuid,
  code text,
  name text,
  act text,
  event_date date,
  status text,
  palette text,
  credit_balance numeric,
  purchased numeric,
  spent numeric,
  songs bigint
)
language sql security definer stable set search_path = public
as $$
  select
    a.event_id,
    e.code,
    e.name,
    e.act,
    e.event_date,
    e.status,
    e.palette,
    a.credit_balance,
    coalesce(cp.purchased, 0)::numeric as purchased,
    (
      coalesce(req.spent, 0) + coalesce(b.spent, 0)
    )::numeric as spent,
    coalesce(sg.songs, 0)::bigint as songs
  from public.attendees a
  join public.events e on e.id = a.event_id
  left join (
    select r.event_id, r.user_id,
           sum(r.credits) filter (
             where r.status in ('pending', 'approved', 'playing', 'played')
           )::numeric as spent
      from public.requests r
     group by r.event_id, r.user_id
  ) req on req.event_id = a.event_id and req.user_id = a.user_id
  left join (
    select b.event_id, b.user_id, sum(b.amount)::numeric as spent
      from public.bids b
     group by b.event_id, b.user_id
  ) b on b.event_id = a.event_id and b.user_id = a.user_id
  left join (
    select u.event_id, u.user_id, count(distinct u.identity) as songs
      from (
        select r.event_id, r.user_id,
               coalesce(
                 r.deezer_id::text,
                 lower(coalesce(r.song_title, '')) || '|' ||
                 lower(coalesce(r.song_artist, ''))
               ) as identity
          from public.requests r
         where r.status in ('pending', 'approved', 'playing', 'played')
        union all
        select b.event_id, b.user_id,
               coalesce(
                 t.deezer_id::text,
                 lower(coalesce(t.title, '')) || '|' ||
                 lower(coalesce(t.artist, ''))
               ) as identity
          from public.bids b
          join public.event_tracks t on t.id = b.track_id
      ) u
     group by u.event_id, u.user_id
  ) sg on sg.event_id = a.event_id and sg.user_id = a.user_id
  left join (
    select event_id, user_id, sum(revenue_cents)::numeric / 100 as purchased
      from public.credit_purchases
     group by event_id, user_id
  ) cp on cp.event_id = a.event_id and cp.user_id = a.user_id
  where a.user_id = auth.uid()
  order by a.created_at desc
$$;
