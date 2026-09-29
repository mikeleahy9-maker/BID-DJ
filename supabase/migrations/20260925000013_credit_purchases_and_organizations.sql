-- ----------------------------------------------------------------------------
-- Guest credit PURCHASES (real money) + the organization entity that revenue
-- is settled to.
--
-- Why a ledger is required:
--   Credits and dollars are different currencies and must never be conflated.
--   A guest paying $20 receives 23 credits (3 are bonus). At settlement the
--   split must be computed from DOLLARS COLLECTED (revenue_cents), never from
--   credits x $1, or BidaBeat would distribute money it never received.
--
--   Guests are charged at purchase time. Bidding is only a queue-priority
--   mechanic: refund_track() returns credits to the guest's balance for
--   re-bidding, but it does NOT reduce revenue. Event close is pure
--   accounting -- no further charge is ever made to the guest.
--
-- Two-phase money movement (deliberate, for now):
--   1. Guest buys credits -> funds land in the PLATFORM balance. No Connect.
--   2. At event close, BidaBeat computes eligible revenue and transfers
--      70% organizer / 20% DJ / 10% platform.
--   Step 2 requires Stripe Connect accounts, which do not exist yet. Until they
--   do, step 1 is fully functional and step 2 is display-only.
--
-- The schema below is shaped so that adding Connect in a later migration is
-- additive only -- no backfill of real financial rows will be required.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. ORGANIZATIONS
--
-- The organizer is NOT a BidaBeat user. They receive money but may never log
-- in. So it is a first-class entity with its own lifecycle rather than a field
-- on the event.
--
-- stripe_account_id is the reuse key: once set, the onboarding flow
-- short-circuits. Because the key lives on the organization (not the event),
-- reuse across repeated DJ bookings -- and across different DJs booking the
-- same venue -- happens automatically with no extra logic.
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Identity key. The invite flow looks up by this, so it is unique and
  -- case-insensitive: "venue@x.com" and "Venue@X.com" must resolve to the
  -- same organization, or a venue gets onboarded twice and ends up with a
  -- duplicate (and Stripe-rejected) Connect account.
  contact_email text not null,
  stripe_account_id text,
  onboarded_at timestamptz,
  status text not null default 'invited'
    check (status in ('invited', 'onboarded', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Postgres unique indexes are case-sensitive, so normalize on write and
-- enforce with a plain unique index.
create unique index if not exists organizations_contact_email_key
  on public.organizations (lower(contact_email));

alter table public.organizations enable row level security;

-- ----------------------------------------------------------------------------
-- 2. ATTACH ORGANIZATIONS TO EVENTS
--
-- Must be set BEFORE guests can pay: revenue recorded against an event with a
-- null organization has no settlement destination and becomes a manual
-- reconciliation problem. The event setup flow enforces this going forward.
-- Nullable here so existing events are not broken by the migration.
--
-- This must come BEFORE the organizations RLS policies below, because those
-- policies read events.organization_id.
-- ----------------------------------------------------------------------------
alter table public.events
  add column if not exists organization_id uuid
  references public.organizations(id) on delete set null;

-- Organizer share, alongside the existing events.payout_rate (DJ share).
-- platform = 1 - dj - organizer, so the three always sum to exactly 1.
alter table public.events
  add column if not exists organizer_rate numeric(4,3) not null default 0.700;

-- A DJ on one of the organization's events may read/update it. Read-only for
-- helpers: they can work a queue but must not edit the payout destination.
drop policy if exists "organizations_select_related" on public.organizations;
create policy "organizations_select_related" on public.organizations
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.organization_id = organizations.id
        and public.is_event_dj(e.id)
    )
    or public.is_admin()
  );

drop policy if exists "organizations_update_related_dj" on public.organizations;
create policy "organizations_update_related_dj" on public.organizations
  for update to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.organization_id = organizations.id
        and e.dj_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.events e
      where e.organization_id = organizations.id
        and e.dj_id = auth.uid()
    )
    or public.is_admin()
  );

create index if not exists events_organization_id_idx
  on public.events (organization_id);

-- ----------------------------------------------------------------------------
-- 3. CREDIT PURCHASE LEDGER
--
-- One row per completed Stripe Checkout session. This is the financial
-- record of truth; attendees.credit_balance is only the gameplay balance.
--
-- stripe_session_id is UNIQUE and is what makes the webhook idempotent:
-- Stripe retries deliveries, and without this a retry would credit the guest
-- a second time.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  -- Denormalized from the event at purchase time so an event's settlement
  -- total can be computed without joining through a mutable FK.
  organization_id uuid references public.organizations(id) on delete set null,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  -- Gameplay units granted (includes bonus credits).
  credits_granted integer not null check (credits_granted > 0),
  -- Actual dollars collected, in cents. This -- and only this -- is what the
  -- 70/20/10 split is computed from.
  revenue_cents integer not null check (revenue_cents > 0),
  created_at timestamptz not null default now()
);

create index if not exists credit_purchases_event_id_idx
  on public.credit_purchases (event_id);
create index if not exists credit_purchases_user_id_idx
  on public.credit_purchases (user_id);
create index if not exists credit_purchases_organization_id_idx
  on public.credit_purchases (organization_id);

alter table public.credit_purchases enable row level security;

-- A guest may read their own purchases (receipt history). Financial reporting
-- reads go through the event_finance() RPC below, which is DJ-gated.
drop policy if exists "credit_purchases_select_own" on public.credit_purchases;
create policy "credit_purchases_select_own" on public.credit_purchases
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No client insert/update/delete policy: the ledger is written only by the
-- service-role webhook via record_credit_purchase() below.

-- ----------------------------------------------------------------------------
-- 4. RECORD A PURCHASE (service-role only)
--
-- Grants credits and writes the ledger row in one transaction, keyed on the
-- Stripe session id so replayed webhooks converge instead of double-crediting.
--
-- Grants credits + base, so a replay of the same session is a no-op.
-- ----------------------------------------------------------------------------
drop function if exists public.record_credit_purchase(
  p_event_id uuid, p_user_id uuid, p_stripe_session_id text,
  p_stripe_payment_intent_id text, p_credits_granted integer, p_revenue_cents integer
);
create or replace function public.record_credit_purchase(
  p_event_id uuid,
  p_user_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_credits_granted integer,
  p_revenue_cents integer
)
returns public.credit_purchases
language plpgsql security definer volatile set search_path = public
as $$
declare
  v_purchase public.credit_purchases;
  v_organization_id uuid;
begin
  if p_event_id is null or p_user_id is null
     or p_stripe_session_id is null or p_stripe_session_id = ''
     or p_credits_granted is null or p_credits_granted <= 0
     or p_revenue_cents is null or p_revenue_cents <= 0 then
    raise exception 'invalid credit purchase arguments';
  end if;

  select organization_id into v_organization_id
    from public.events where id = p_event_id;

  insert into public.credit_purchases (
    event_id, user_id, organization_id, stripe_session_id,
    stripe_payment_intent_id, credits_granted, revenue_cents
  )
  values (
    p_event_id, p_user_id, v_organization_id, p_stripe_session_id,
    nullif(p_stripe_payment_intent_id, ''), p_credits_granted, p_revenue_cents
  )
  on conflict (stripe_session_id) do nothing
  returning * into v_purchase;

  -- Replay: this session was already recorded. Return the existing row and do
  -- NOT grant credits again.
  if v_purchase is null then
    select * into v_purchase
      from public.credit_purchases
     where stripe_session_id = p_stripe_session_id;
    return v_purchase;
  end if;

  -- Upsert, not update: a plain UPDATE silently matches zero rows if the
  -- attendee row is absent, which would record a real payment in the ledger
  -- while granting the guest nothing. Creating the row here keeps the ledger
  -- and the balance from ever diverging.
  insert into public.attendees (event_id, user_id, checked_in, credit_balance)
  values (p_event_id, p_user_id, true, p_credits_granted)
  on conflict (event_id, user_id) do update
    set credit_balance = public.attendees.credit_balance + p_credits_granted;

  return v_purchase;
end $$;

revoke execute on function public.record_credit_purchase(
  uuid, uuid, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_credit_purchase(
  uuid, uuid, text, text, integer, integer
) to service_role;

-- ----------------------------------------------------------------------------
-- 5. NO FREE CREDITS ON JOIN
--
-- join_event_credits() used to insert credit_balance = 20. Guests must now pay
-- for credits before they can bid or request.
--
-- The function itself is unchanged in shape (place_bid / place_down_bid call it
-- to ensure the attendee row exists before debiting) -- only the grant is gone.
-- ----------------------------------------------------------------------------
create or replace function public.join_event_credits(p_event_id uuid)
returns public.attendees
language plpgsql security definer volatile set search_path = public
as $$
declare
  v_attendee public.attendees;
begin
  if p_event_id is null or auth.uid() is null then
    return null;
  end if;

  insert into public.attendees (event_id, user_id, checked_in, credit_balance)
  values (p_event_id, auth.uid(), true, 0)
  on conflict (event_id, user_id) do nothing
  returning * into v_attendee;

  if v_attendee is null then
    select * into v_attendee
      from public.attendees
     where event_id = p_event_id and user_id = auth.uid();
  end if;

  return v_attendee;
end $$;

-- Pre-existing balances were granted for free and have no matching purchase
-- row, so they must not become spendable credit. Zero only rows with no
-- purchase on record -- re-runnable and safe against later real balances.
update public.attendees a
   set credit_balance = 0
 where a.credit_balance <> 0
   and not exists (
     select 1 from public.credit_purchases cp
      where cp.event_id = a.event_id and cp.user_id = a.user_id
   );

-- ----------------------------------------------------------------------------
-- 6. EVENT FINANCE (DJ-gated read)
--
-- The settlement source of truth. Reads DOLLARS COLLECTED, so bonus credits
-- and refunded bids are correctly excluded from the split. event_finance()
-- computes from revenue_cents only, so a $20 pack granting 23 credits settles
-- at $20, never $23.
-- ----------------------------------------------------------------------------
drop function if exists public.event_finance(p_event_id uuid);
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
  settled boolean
)
language plpgsql security definer stable set search_path = public
as $$
declare
  v_event public.events;
  v_org public.organizations;
  v_total bigint;
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
    count(*),
    count(distinct cp.user_id),
    coalesce(sum(cp.credits_granted), 0)
  into v_total, v_count, v_purchasers, v_credits
  from public.credit_purchases cp
  where cp.event_id = p_event_id;

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
    -- floor() keeps the three cuts summing to exactly the total: rounding
    -- each independently can hand out a cent that was never collected.
    floor(v_total * v_organizer)::bigint,
    floor(v_total * v_dj)::bigint,
    (v_total - floor(v_total * v_organizer) - floor(v_total * v_dj))::bigint,
    v_event.status = 'ended'
  ;
end $$;

revoke execute on function public.event_finance(uuid) from public, anon;
grant execute on function public.event_finance(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. DASHBOARD: purchased + spent per event
--
-- spent still reflects requests only; purchased is the new real-money column
-- so the guest dashboard can show what they actually paid.
-- ----------------------------------------------------------------------------
drop function if exists public.guest_my_events();
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
    coalesce(sum(r.credits) filter (where r.status in ('pending', 'approved', 'playing', 'played')), 0)::numeric as spent,
    count(r.id) filter (where r.status in ('pending', 'approved', 'playing', 'played'))::bigint as songs
  from public.attendees a
  join public.events e on e.id = a.event_id
  left join public.requests r on r.event_id = a.event_id and r.user_id = a.user_id
  left join (
    select event_id, user_id, sum(revenue_cents)::numeric / 100 as purchased
      from public.credit_purchases
     group by event_id, user_id
  ) cp on cp.event_id = a.event_id and cp.user_id = a.user_id
  where a.user_id = auth.uid()
  group by a.event_id, e.code, e.name, e.act, e.event_date, e.status, e.palette, a.credit_balance, a.created_at, cp.purchased
  order by a.created_at desc
$$;
