-- ============================================================================
-- SPLIT ON NET REVENUE
--
-- The 70/20/10 split used to run on gross revenue -- the dollars guests were
-- charged. That number never reaches our available balance: Stripe takes its
-- processing fee off each charge first, and stripe.transfers can only move
-- funds that are actually available. Splitting gross therefore promises more
-- money than exists.
--
--   $70.00 charged, $2.63 in fees, $67.37 arrives
--   gross split:  $49.00 + $14.00 = $63.00 owed   (platform keeps $7.00)
--   net split:    $47.16 + $13.47 = $60.63 owed   (platform keeps $6.74)
--
-- Worse, for a small event the flat $0.30-per-charge portion can exceed the
-- platform's entire 10%, so a gross split asks for more than the balance will
-- ever hold and can never be paid. Splitting net is the only basis where the
-- three cuts always sum to exactly what is available.
--
-- fee_cents is read from the charge's balance_transaction, which is the
-- authoritative figure -- a hardcoded 2.9% + $0.30 would drift on Amex,
-- international cards and currency conversion.
-- ============================================================================

alter table public.credit_purchases
  add column if not exists fee_cents integer not null default 0;

comment on column public.credit_purchases.fee_cents is
  'Stripe processing fee taken off this charge, in cents. 0 means not yet read '
  'from Stripe (or there is no Stripe reference, e.g. a manually seeded row).';

alter table public.event_settlements
  add column if not exists stripe_fees_cents bigint not null default 0,
  add column if not exists net_revenue_cents bigint not null default 0;

comment on column public.event_settlements.net_revenue_cents is
  'total_revenue_cents minus stripe_fees_cents. This -- not gross -- is what '
  'organizer_cents / dj_cents / platform_cents were computed from.';

-- ----------------------------------------------------------------------------
-- event_finance(): same shape plus fees and net; cuts now derived from net.
-- The return type changed, so the old function must be dropped first --
-- create or replace cannot alter it.
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

  -- What actually lands in our balance. Guarded at zero: a row whose fees have
  -- not been read back from Stripe yet would otherwise go negative.
  v_net := greatest(0, v_total - v_fees);

  -- Rates come from the event, so a venue can be negotiated per gig. They are
  -- stored to 3 decimals and always sum to 1 with the platform remainder.
  v_dj := coalesce(v_event.payout_rate, 0.200);
  v_organizer := coalesce(v_event.organizer_rate, 0.700);

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
    -- floor() keeps the three cuts summing to exactly v_net: rounding each
    -- independently can hand out a cent that was never collected.
    floor(v_net * v_organizer)::bigint,
    floor(v_net * v_dj)::bigint,
    (v_net - floor(v_net * v_organizer) - floor(v_net * v_dj))::bigint,
    v_fees,
    v_net,
    v_event.status = 'ended'
  ;
end $$;

revoke execute on function public.event_finance(uuid) from public, anon;
grant execute on function public.event_finance(uuid) to authenticated, service_role;
