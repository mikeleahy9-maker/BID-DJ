-- Guest bidding on the live queue.
--
-- Every bid is a row in `bids` (one row per guest per track, so a repeat bid
-- from the same guest tops up their existing stake rather than forking the
-- count). `event_tracks.credits` stays the board's cached total (seed credits
-- + everyone's bids) and `event_tracks.bidders` caches the distinct bidder
-- count, so the board renders without a join.
--
-- Guests cannot write to event_tracks directly (RLS is is_event_dj only), so
-- all bidding goes through the security-definer `place_bid`, which:
--   1. ensures the guest has an attendees row for the event
--   2. atomically debits their credit_balance, refusing to go negative
--   3. upserts their bids row (bidders bumps only on a new bidder)
--   4. re-sorts the board by bumping credits
-- It returns the new credit_balance so the client can update its wallet.
--
-- Down-bids and refund settlement land in 20260925000009_bid_down_and_refund.sql.

-- ----------------------------------------------------------------------------
-- 1. BIDS LEDGER
-- ----------------------------------------------------------------------------
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  track_id uuid not null references public.event_tracks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, user_id)
);

create index if not exists bids_event_id_idx on public.bids (event_id);
create index if not exists bids_user_id_idx on public.bids (user_id);

-- Cached distinct-bidder count per track (kept in step by place_bid).
alter table public.event_tracks
  add column if not exists bidders integer not null default 0;

-- ----------------------------------------------------------------------------
-- 2. PLACE BID (atomic: debits credits, upserts the stake, re-sorts the board)
-- ----------------------------------------------------------------------------
drop function if exists public.place_bid(p_track_id uuid, p_amount numeric);
create or replace function public.place_bid(p_track_id uuid, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_track public.event_tracks;
  v_balance numeric;
  v_is_new boolean;
begin
  if p_track_id is null or p_amount is null or p_amount <= 0 or auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_bid');
  end if;

  -- Lock the track so concurrent bids can't interleave the credit/cache writes.
  select * into v_track
    from public.event_tracks
   where id = p_track_id
     for update;

  if v_track is null then
    return jsonb_build_object('ok', false, 'error', 'song_not_found');
  end if;

  -- Only live, still-queued songs can be bid on.
  if v_track.status <> 'queued'
     or not exists (
       select 1 from public.events e
        where e.id = v_track.event_id and e.status = 'live'
     ) then
    return jsonb_build_object('ok', false, 'error', 'event_not_live');
  end if;

  -- Make sure the bidder has an attendees row before touching credits.
  perform public.join_event_credits(v_track.event_id);

  -- Atomically debit, refusing to go negative.
  update public.attendees
     set credit_balance = credit_balance - p_amount
   where event_id = v_track.event_id
     and user_id = auth.uid()
     and credit_balance >= p_amount
  returning credit_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  end if;

  -- Upsert the stake; a brand new bidder increments the cached count.
  insert into public.bids (event_id, track_id, user_id, amount)
  values (v_track.event_id, p_track_id, auth.uid(), p_amount)
  on conflict (track_id, user_id) do update
    set amount = public.bids.amount + excluded.amount,
        updated_at = now()
  returning (xmax = 0) as inserted into v_is_new;

  -- Keep the board cache in step: total credits up, bidders up on first bid.
  update public.event_tracks
     set credits = credits + p_amount,
         bidders = bidders + (case when v_is_new then 1 else 0 end)
   where id = p_track_id;

  return jsonb_build_object(
    'ok', true,
    'credit_balance', v_balance,
    'track_id', p_track_id
  );
end $$;

-- ----------------------------------------------------------------------------
-- 3. BIDS RLS
--    Guests read their own stake (or the DJ reads the room's), but nobody
--    writes directly — every bid goes through the definer functions above.
--    The board itself stays public via the cached event_tracks.bidders.
-- ----------------------------------------------------------------------------
alter table public.bids enable row level security;

drop policy if exists "bids_select_own_dj" on public.bids;
create policy "bids_select_own_dj" on public.bids
  for select using (user_id = auth.uid() or public.is_event_dj(event_id));

-- Realtime: guests watch the board, not individual bid rows, but publishing
-- bids keeps the DJ's bidder count live without a refetch.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bids'
  ) then
    alter publication supabase_realtime add table public.bids;
  end if;
end $$;
