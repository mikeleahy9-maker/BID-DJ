-- ----------------------------------------------------------------------------
-- Down-bids + refund settlement.
--
-- Delta migration. `20260925000008_bids.sql` was already applied before the
-- down-bid and refund work landed, so editing it was a no-op. This applies
-- everything that was added afterwards, idempotently, so it is safe on both
-- an existing database and a fresh one where the amended 00008 already ran.
--
--   1. add the `kind` direction column to `bids` (existing rows are all 'up')
--   2. widen the uniqueness key to (track_id, user_id, kind) so one guest can
--      hold both an up stake and a down stake on the same song
--   3. replace place_bid so stakes are tagged
--   4. add place_down_bid and refund_track
--
-- REFUND RULE: credits committed to a song are consumed only if the song
-- actually plays. refund_track pays every guest stake on the track (up and
-- down alike) back to its owner before deleting the track. The DJ's pre-loaded
-- seed credits live in event_tracks.credits and never appear in `bids`, so
-- they are excluded from refunds by construction.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. BIDS DIRECTION COLUMN
--    `amount` stays the positive number of credits actually paid; `kind` says
--    which way the stake moved the pot. That keeps the refund a single
--    symmetric sum(amount) with no sign handling.
-- ----------------------------------------------------------------------------
alter table public.bids
  add column if not exists kind text not null default 'up' check (kind in ('up', 'down'));

update public.bids set kind = 'up' where kind is null;

-- One guest may hold an up stake and a down stake on the same song.
alter table public.bids drop constraint if exists bids_track_id_user_id_key;
create unique index if not exists bids_track_user_kind_key
  on public.bids (track_id, user_id, kind);

create index if not exists bids_event_id_idx on public.bids (event_id);
create index if not exists bids_user_id_idx on public.bids (user_id);

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
  insert into public.bids (event_id, track_id, user_id, kind, amount)
  values (v_track.event_id, p_track_id, auth.uid(), 'up', p_amount)
  on conflict (track_id, user_id, kind) do update
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
-- 3. PLACE DOWN BID — a paid "nudge this song down" vote.
--    Credits are for fun, so the rules stay honest and readable:
--      · the floor is 0, not 1 — a song can be driven all the way down
--      · the drop can never exceed what the song still has
--      · over-bidding is REJECTED rather than silently clamped, so a guest
--        never pays more credits than the song can actually lose. The error
--        carries `max_down` so the client can say "you only need 2 to reach 0".
--    The stake is recorded with kind = 'down' and amount = what was actually
--    PAID, so refund_track returns it verbatim.
--    This version left down votes out of the event_tracks.bidders cache;
--    20260925000011_bidder_count_includes_down.sql widens it to count both.
-- ----------------------------------------------------------------------------
drop function if exists public.place_down_bid(p_track_id uuid, p_amount numeric);
create or replace function public.place_down_bid(p_track_id uuid, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_track public.event_tracks;
  v_balance numeric;
  v_max_down numeric;
begin
  if p_track_id is null or p_amount is null or p_amount <= 0 or auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_bid');
  end if;

  select * into v_track
    from public.event_tracks
   where id = p_track_id
     for update;

  if v_track is null then
    return jsonb_build_object('ok', false, 'error', 'song_not_found');
  end if;

  if v_track.status <> 'queued'
     or not exists (
       select 1 from public.events e
        where e.id = v_track.event_id and e.status = 'live'
     ) then
    return jsonb_build_object('ok', false, 'error', 'event_not_live');
  end if;

  perform public.join_event_credits(v_track.event_id);

  -- The song can be driven all the way to 0, so the floor is 0.
  v_max_down := v_track.credits;

  if v_max_down <= 0 then
    return jsonb_build_object('ok', false, 'error', 'already_at_bottom');
  end if;

  -- Reject an over-bid instead of clamping, so nobody overpays. max_down tells
  -- the client the exact amount that would take the song to 0.
  if p_amount > v_max_down then
    return jsonb_build_object(
      'ok', false,
      'error', 'over_bid',
      'max_down', v_max_down
    );
  end if;

  update public.attendees
     set credit_balance = credit_balance - p_amount
   where event_id = v_track.event_id
     and user_id = auth.uid()
     and credit_balance >= p_amount
  returning credit_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  end if;

  -- Record what was paid so an unplayed song refunds it in full.
  insert into public.bids (event_id, track_id, user_id, kind, amount)
  values (v_track.event_id, p_track_id, auth.uid(), 'down', p_amount)
  on conflict (track_id, user_id, kind) do update
    set amount = public.bids.amount + excluded.amount,
        updated_at = now();

  update public.event_tracks
     set credits = credits - p_amount
   where id = p_track_id;

  return jsonb_build_object(
    'ok', true,
    'credit_balance', v_balance,
    'track_id', p_track_id,
    'drop', p_amount
  );
end $$;

-- ----------------------------------------------------------------------------
-- 3b. REFUND TRACK — settle an unplayed song and return every guest stake.
--    The DJ's REFUND button used to delete the track outright, which cascaded
--    the bids away and silently ate everyone's credits. This pays the ledger
--    back to its owners first, then deletes.
--    Only the event's DJ may call it, and only while the song is still queued:
--    a song that already played has consumed its credits.
-- ----------------------------------------------------------------------------
drop function if exists public.refund_track(p_track_id uuid);
create or replace function public.refund_track(p_track_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_track public.event_tracks;
  v_refunded numeric;
  v_holders integer;
begin
  select * into v_track
    from public.event_tracks
   where id = p_track_id
     for update;

  if v_track is null then
    return jsonb_build_object('ok', false, 'error', 'song_not_found');
  end if;

  -- security definer bypasses RLS, so this check is what stops any signed-in
  -- guest from minting themselves credits by refunding arbitrary songs.
  if not public.is_event_dj(v_track.event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if v_track.status = 'played' then
    return jsonb_build_object('ok', false, 'error', 'already_played');
  end if;

  select coalesce(sum(amount), 0), count(distinct user_id)
    into v_refunded, v_holders
    from public.bids
   where track_id = p_track_id;

  -- Credit each holder back the total they committed (up and down stakes alike).
  update public.attendees a
     set credit_balance = a.credit_balance + s.total
    from (
      select user_id, sum(amount) as total
        from public.bids
       where track_id = p_track_id
       group by user_id
    ) s
   where a.event_id = v_track.event_id
     and a.user_id = s.user_id;

  -- Deleting the track cascades the now-settled bids rows away.
  delete from public.event_tracks where id = p_track_id;

  return jsonb_build_object(
    'ok', true,
    'refunded', v_refunded,
    'holders', v_holders,
    'track_id', p_track_id
  );
end $$;

-- ----------------------------------------------------------------------------
-- 4. BIDS RLS
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
