-- ============================================================================
-- AUTO-CLOSE STALE EVENTS
--
-- A DJ who goes live and never taps "End event" used to leave the event in
-- 'live' forever: guests could keep bidding and the night never settled. This
-- migration makes the 36-hour auto-close possible:
--
--  1. events.live_at records WHEN the event went live (a trigger stamps it on
--     the 'draft' -> 'live' transition). updated_at is unusable: it moves on
--     every later edit, so it can't anchor a 36h window.
--
--  2. event_finance() becomes a guarded wrapper over an unguarded core, and a
--     new event_finance_system() exposes the core to service_role only. The
--     auto-close sweep runs with no DJ session (auth.uid() is null), and the
--     original function returns nothing in that case -- so a background close
--     would silently settle the night at $0. The system entry point solves
--     that without letting an ordinary authenticated user read another DJ's
--     finances.
--
--  3. A pg_cron job POSTs /api/cron/auto-close every hour. That route books the
--     settlement for each stale event (money still moves later via the existing
--     sweep), exactly like a manual end.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. live_at + transition trigger
-- ----------------------------------------------------------------------------
alter table public.events
  add column if not exists live_at timestamptz;

comment on column public.events.live_at is
  'When the event most recently transitioned to status = ''live''. Anchors the 36h auto-close window.';

-- Backfill: for an event that is live right now, updated_at is the closest
-- thing we have to its start time (set by the last status write).
update public.events
   set live_at = updated_at
 where status = 'live'
   and live_at is null;

create or replace function public.set_events_live_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'live' and (old.status is distinct from 'live') then
    new.live_at := now();
  end if;
  return new;
end $$;

drop trigger if exists events_set_live_at on public.events;
create trigger events_set_live_at
  before update on public.events
  for each row execute function public.set_events_live_at();

-- ----------------------------------------------------------------------------
-- 2. event_finance(): core + guarded wrapper + service-role system entry point.
--    Same return shape and maths as 20261006000002; only the authorization
--    guard moves out of the body.
-- ----------------------------------------------------------------------------
create or replace function public._event_finance_core(p_event_id uuid)
returns table (
  event_id uuid,
  event_status text,
  organization_id uuid,
  organization_name text,
  organization_stripe_account_id text,
  dj_rate numeric,
  organizer_rate numeric,
  platform_rate numeric,
  total_revenue_cents bigint,
  purchase_count bigint,
  purchaser_count bigint,
  credits_granted bigint,
  organizer_cents bigint,
  dj_cents bigint,
  platform_cents bigint,
  total_fees_cents bigint,
  net_revenue_cents bigint,
  organizer_gross_cents bigint,
  organizer_fee_cents bigint,
  dj_gross_cents bigint,
  dj_fee_cents bigint,
  settled boolean
)
language plpgsql security definer stable set search_path = public
as $$
declare
  v_event public.events;
  v_org public.organizations;
  v_total bigint;
  v_fees bigint;
  v_net bigint;
  v_count bigint;
  v_purchasers bigint;
  v_credits bigint;
  v_dj numeric;
  v_organizer numeric;
  v_org_gross bigint;
  v_dj_gross bigint;
  v_org_fee bigint;
  v_dj_fee bigint;
  v_org_net bigint;
  v_dj_net bigint;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event is null then
    return;
  end if;

  if v_event.organization_id is not null then
    select * into v_org from public.organizations where id = v_event.organization_id;
  end if;

  select
    coalesce(sum(cp.revenue_cents), 0),
    coalesce(sum(cp.fee_cents), 0),
    count(*),
    count(distinct cp.user_id),
    coalesce(sum(cp.credits_granted), 0)
  into v_total, v_fees, v_count, v_purchasers, v_credits
  from public.credit_purchases cp
  where cp.event_id = p_event_id;

  v_net := greatest(0, v_total - v_fees);

  v_dj := coalesce(v_event.payout_rate, 0.200);
  v_organizer := coalesce(v_event.organizer_rate, 0.700);

  v_org_gross := floor(v_total * v_organizer)::bigint;
  v_dj_gross := floor(v_total * v_dj)::bigint;
  v_org_fee := floor(v_fees * v_organizer)::bigint;
  v_dj_fee := floor(v_fees * v_dj)::bigint;
  v_org_net := greatest(0, v_org_gross - v_org_fee);
  v_dj_net := greatest(0, v_dj_gross - v_dj_fee);

  return query
  select
    v_event.id,
    v_event.status,
    v_event.organization_id,
    v_org.name,
    v_org.stripe_account_id,
    v_dj,
    v_organizer,
    greatest(0, 1 - v_dj - v_organizer),
    v_total,
    v_count,
    v_purchasers,
    v_credits,
    v_org_net,
    v_dj_net,
    (v_net - v_org_net - v_dj_net)::bigint,
    v_fees,
    v_net,
    v_org_gross,
    v_org_fee,
    v_dj_gross,
    v_dj_fee,
    v_event.status = 'ended'
  ;
end $$;

-- Private core: no role may call it directly. The two wrappers below are
-- security definer (they run as this owner) and can still reach it.
revoke all on function public._event_finance_core(uuid) from public, anon, authenticated;

-- Owner-guarded entry point (the DJ's own session, unchanged behaviour).
create or replace function public.event_finance(p_event_id uuid)
returns table (
  event_id uuid,
  event_status text,
  organization_id uuid,
  organization_name text,
  organization_stripe_account_id text,
  dj_rate numeric,
  organizer_rate numeric,
  platform_rate numeric,
  total_revenue_cents bigint,
  purchase_count bigint,
  purchaser_count bigint,
  credits_granted bigint,
  organizer_cents bigint,
  dj_cents bigint,
  platform_cents bigint,
  total_fees_cents bigint,
  net_revenue_cents bigint,
  organizer_gross_cents bigint,
  organizer_fee_cents bigint,
  dj_gross_cents bigint,
  dj_fee_cents bigint,
  settled boolean
)
language sql security definer stable set search_path = public
as $$
  select *
  from public._event_finance_core(p_event_id)
  where public.is_event_dj(p_event_id)
$$;

revoke execute on function public.event_finance(uuid) from public, anon;
grant execute on function public.event_finance(uuid) to authenticated, service_role;

-- System entry point: the background auto-close sweep. service_role only, so
-- an authenticated user can never read another DJ's finance row.
create or replace function public.event_finance_system(p_event_id uuid)
returns table (
  event_id uuid,
  event_status text,
  organization_id uuid,
  organization_name text,
  organization_stripe_account_id text,
  dj_rate numeric,
  organizer_rate numeric,
  platform_rate numeric,
  total_revenue_cents bigint,
  purchase_count bigint,
  purchaser_count bigint,
  credits_granted bigint,
  organizer_cents bigint,
  dj_cents bigint,
  platform_cents bigint,
  total_fees_cents bigint,
  net_revenue_cents bigint,
  organizer_gross_cents bigint,
  organizer_fee_cents bigint,
  dj_gross_cents bigint,
  dj_fee_cents bigint,
  settled boolean
)
language sql security definer stable set search_path = public
as $$
  select * from public._event_finance_core(p_event_id)
$$;

revoke execute on function public.event_finance_system(uuid) from public, anon, authenticated;
grant execute on function public.event_finance_system(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 3. Hourly auto-close sweep.
--
-- Same shared-secret pattern as bidabeat-settle (see 20261006000002): the
-- secret is authored into the job body because Supabase's postgres role cannot
-- hold it in a custom GUC. Treat it as a low-trust convenience token.
--
-- On the minute offset so it does not collide with the daily settle job.
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('bidabeat-auto-close')
 where exists (select 1 from cron.job where jobname = 'bidabeat-auto-close');

select cron.schedule(
  'bidabeat-auto-close',
  '15 * * * *',
  'select net.http_post(
    url := ''https://bidabeat.vercel.app/api/cron/auto-close'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer 1b0202a12b3a6b08074bd82d63027c9ac8f894d70deded1f4055aafcabf9b977''
    ),
    body := ''{}''
  )'
);
