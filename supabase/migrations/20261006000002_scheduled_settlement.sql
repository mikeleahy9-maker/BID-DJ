-- ============================================================================
-- SCHEDULED SETTLEMENT
--
-- Two changes on top of 20261006000001:
--
--  1. Closing an event no longer moves money. The DJ endpoint only books the
--     settlement (amounts, fees, shares) and ends the event; every leg starts
--     out 'pending'. Money is moved LATER, by a scheduled retry, once Stripe
--     has settled the charges into the available balance (~1 week). Trying to
--     transfer at close time can never succeed: charges land in `pending` and
--     only become `available` on their balance_transaction's available_on
--     date, so the transfer would just be rejected.
--
--  2. The 70/20/10 is stored per party WITH the fee deduction, so the DJ and
--     organizer can see exactly what Stripe took from their share:
--       *_{gross}_cents  share of GROSS revenue at that party's rate
--       *_{fee}_cents    their proportional share of the processing fees
--       *_cents          what they actually receive (gross - fee, never < 0)
--     The platform absorbs every rounding cent (platform = net - both shares).
-- ============================================================================

alter table public.event_settlements
  add column if not exists organizer_gross_cents bigint not null default 0,
  add column if not exists organizer_fee_cents bigint not null default 0,
  add column if not exists dj_gross_cents bigint not null default 0,
  add column if not exists dj_fee_cents bigint not null default 0;

comment on column public.event_settlements.organizer_gross_cents is
  'Organizer share of GROSS revenue (before fees), in cents.';
comment on column public.event_settlements.organizer_fee_cents is
  'Stripe processing fees charged to the organizer share, in cents.';
comment on column public.event_settlements.dj_gross_cents is
  'DJ share of GROSS revenue (before fees), in cents.';
comment on column public.event_settlements.dj_fee_cents is
  'Stripe processing fees charged to the DJ share, in cents.';

-- ----------------------------------------------------------------------------
-- event_finance(): returns the gross share and fee share for each party. The
-- net shares now derive from (gross share - fee share) instead of a straight
-- (net * rate) so every party's deduction is visible and reportable.
-- Return type changed again, so drop then create.
-- ----------------------------------------------------------------------------

drop function if exists public.event_finance(uuid);

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
  if v_event is null or not public.is_event_dj(p_event_id) then
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

  -- What actually lands in our balance. Guarded at zero: a purchase whose fees
  -- have not been read back from Stripe yet would otherwise go negative.
  v_net := greatest(0, v_total - v_fees);

  -- Rates come from the event, so a venue can be negotiated per gig. They are
  -- stored to 3 decimals and always sum to 1 with the platform remainder.
  v_dj := coalesce(v_event.payout_rate, 0.200);
  v_organizer := coalesce(v_event.organizer_rate, 0.700);

  -- Each party's slice of GROSS, minus their slice of the fees. Never below
  -- zero; the platform takes whatever is left, which also absorbs every
  -- rounding cent, so the three nets always sum to exactly v_net.
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

revoke execute on function public.event_finance(uuid) from public, anon;
grant execute on function public.event_finance(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Reclassify legacy rows. Before insufficient-funds was recognized as a safe,
-- retryable hold, a not-yet-funded transfer was recorded as 'failed'. Those
-- rejections never created anything on Stripe's side, so flipping them to
-- 'held' is safe: a later retry uses a fresh idempotency key and cannot pay
-- twice. Only attempted, never-sent legs are touched.
-- ----------------------------------------------------------------------------

update public.event_settlements
   set organizer_status = 'held'
 where organizer_status = 'failed'
   and organizer_attempt > 0
   and organizer_failure_reason ~* 'insufficient.*funds|exceeds your available balance';

update public.event_settlements
   set dj_status = 'held'
 where dj_status = 'failed'
   and dj_attempt > 0
   and dj_failure_reason ~* 'insufficient.*funds|exceeds your available balance';

-- ----------------------------------------------------------------------------
-- Scheduled transfer sweep.
--
-- Every morning, pg_cron POSTs to the Next.js API, which sends whatever
-- shares are due now that Stripe has settled the charges. The API is guarded
-- by a shared secret, and is idempotent, so a missed or doubled run cannot
-- pay anyone twice.
--
-- Before pushing, replace the two placeholders:
--   1. THE_APP_URL      the public base URL of the deployed app
--   2. CRON_SECRET      a new long random value, kept in sync with the
--                       CRON_SECRET env var on the server
--
-- The secret is authored directly into the job definition (below) rather than
-- read through a custom GUC (ALTER DATABASE ... SET app.* is not permitted for
-- Supabase's non-superuser postgres role). It lives in the cron.job table, so
-- treat it as a low-trust convenience secret, not a root credential.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('bidabeat-settle')
 where exists (select 1 from cron.job where jobname = 'bidabeat-settle');

-- The job body is single-quoted ('' is an escaped quote) rather than
-- dollar-quoted: supabase db push's statement splitter can mis-handle a $$ body
-- inside cron.schedule and report "unterminated dollar-quoted string".
select cron.schedule(
  'bidabeat-settle',
  '0 6 * * *',
  'select net.http_post(
    url := ''https://bidabeat.vercel.app/api/cron/settle'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer 1b0202a12b3a6b08074bd82d63027c9ac8f894d70deded1f4055aafcabf9b977''
    ),
    body := ''{}''
  )'
);