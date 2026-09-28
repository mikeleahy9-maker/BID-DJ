-- ----------------------------------------------------------------------------
-- Accurate "Guests Bidding" stat for the public event page.
--
-- The landing page counted distinct `requests.user_id`, which answers "how many
-- guests requested a song", not "how many guests bid". The two diverge: a guest
-- who bids without requesting is missing, and a guest who only requested is
-- wrongly counted.
--
-- Guests cannot fix this client-side because the bids RLS policy is
--   user_id = auth.uid() or is_event_dj(event_id)
-- so a guest can only ever read their own stake. This definer function returns
-- aggregate counts only — never a user_id — so no bidder identity is exposed.
--
-- Scoped to active (queued/playing) tracks and gated on the event being live,
-- so it cannot be used to probe a finished event's activity.
-- ----------------------------------------------------------------------------
drop function if exists public.event_bid_stats(p_event_id uuid);
create or replace function public.event_bid_stats(p_event_id uuid)
returns jsonb
language sql security definer stable set search_path = public
as $$
  select case
    when p_event_id is null
      or not exists (
        select 1 from public.events e
         where e.id = p_event_id and e.status = 'live'
      )
    then jsonb_build_object('bidders', 0, 'voters', 0, 'credits', 0)
    else jsonb_build_object(
      -- Matches the semantics of the per-song event_tracks.bidders cache:
      -- distinct guests backing a song with an up bid.
      'bidders', (
        select count(distinct b.user_id)
          from public.bids b
          join public.event_tracks t on t.id = b.track_id
         where t.event_id = p_event_id
           and t.status in ('queued', 'playing')
           and b.kind = 'up'
      ),
      -- Any vote at all, up or down: everyone taking part in the queue.
      'voters', (
        select count(distinct b.user_id)
          from public.bids b
          join public.event_tracks t on t.id = b.track_id
         where t.event_id = p_event_id
           and t.status in ('queued', 'playing')
      ),
      'credits', (
        select coalesce(sum(t.credits), 0)
          from public.event_tracks t
         where t.event_id = p_event_id
           and t.status in ('queued', 'playing')
      )
    )
  end;
$$;

revoke execute on function public.event_bid_stats(uuid) from public;
grant execute on function public.event_bid_stats(uuid) to anon, authenticated;
