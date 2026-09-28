-- ----------------------------------------------------------------------------
-- Count BOTH up and down voters in event_tracks.bidders.
--
-- Two problems with the previous cache:
--
--   1. place_down_bid never touched `bidders` at all, so a guest who only
--      voted a song down was invisible on the board.
--   2. Both functions used `returning (xmax = 0)` from the
--      `on conflict (track_id, user_id, kind)` upsert to decide whether this
--      was a brand-new voter. That only detects whether *that kind's* row was
--      new. Because uniqueness is per (track, user, kind), a guest who already
--      had a down stake and then up-bid would insert a fresh 'up' row, report
--      xmax = 0, and be counted twice.
--
-- Fix: stop inferring the count incrementally and recompute it from the ledger.
--   bidders = count(distinct user_id) over ALL bid rows on the track, either
--   kind. It is self-correcting, so it can never drift out of step with `bids`
--   the way a blind `+1` can, and it repairs any historical drift on apply.
--
-- The count is still per-guest, not per-vote: one guest tapping +1 five times
-- counts once, and that guest holding both an up and a down stake counts once.
--
-- DJ earnings are derived from event_tracks.credits (the pot), not from this
-- cache, so widening what `bidders` means does not change payouts.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. PLACE BID — recompute the cache instead of incrementing it
-- ----------------------------------------------------------------------------
drop function if exists public.place_bid(p_track_id uuid, p_amount numeric);
create or replace function public.place_bid(p_track_id uuid, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_track public.event_tracks;
  v_balance numeric;
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

  -- Upsert the stake; a repeat bid from the same guest tops it up rather than
  -- forking the voter count.
  insert into public.bids (event_id, track_id, user_id, kind, amount)
  values (v_track.event_id, p_track_id, auth.uid(), 'up', p_amount)
  on conflict (track_id, user_id, kind) do update
    set amount = public.bids.amount + excluded.amount,
        updated_at = now();

  -- Keep the board cache in step: pot up, voters recounted across both kinds.
  update public.event_tracks t
     set credits = t.credits + p_amount,
         bidders = (
           select count(distinct b.user_id)
             from public.bids b
            where b.track_id = t.id
         )
   where t.id = p_track_id;

  return jsonb_build_object(
    'ok', true,
    'credit_balance', v_balance,
    'track_id', p_track_id
  );
end $$;

-- ----------------------------------------------------------------------------
-- 2. PLACE DOWN BID — now counts toward the voter total
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

  -- Keep the board cache in step: pot down, voters recounted across both kinds.
  update public.event_tracks t
     set credits = t.credits - p_amount,
         bidders = (
           select count(distinct b.user_id)
             from public.bids b
            where b.track_id = t.id
         )
   where t.id = p_track_id;

  return jsonb_build_object(
    'ok', true,
    'credit_balance', v_balance,
    'track_id', p_track_id,
    'drop', p_amount
  );
end $$;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL — repair cached counts for tracks that already have stakes.
--    Recomputing from the ledger also fixes any drift from the old `xmax = 0`
--    heuristic, so the board is correct immediately rather than only for new
--    votes cast after this migration.
-- ----------------------------------------------------------------------------
update public.event_tracks t
   set bidders = (
     select count(distinct b.user_id)
       from public.bids b
      where b.track_id = t.id
   )
 where exists (
   select 1 from public.bids b where b.track_id = t.id
 );
