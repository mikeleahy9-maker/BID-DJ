-- ----------------------------------------------------------------------------
-- Guest dashboard: per-event guest credits on attendees + dashboard read RPC.
--
-- Credits are per-guest, per-event (not a global pool):
--   · entering the queue for a live event grants STARTING_CREDITS (20) once
--   · each request spends REQUEST_COST (2) via spend_attendee_credits
--   · guest_my_events() feeds the guest dashboard (history/stats/balance)
-- Keep the numeric literals in sync with features/guest/data.ts.
-- ----------------------------------------------------------------------------
alter table public.attendees
  add column if not exists credit_balance numeric(10, 2) not null default 0;

-- ----------------------------------------------------------------------------
-- 1. JOIN EVENT (idempotent) — upserts the attendee, granting starting credits
--    only on first join (conflict do nothing). Returns the attendee row.
-- ----------------------------------------------------------------------------
drop function if exists public.join_event_credits(p_event_id uuid);
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
  values (p_event_id, auth.uid(), true, 20)
  on conflict (event_id, user_id) do nothing
  returning * into v_attendee;

  if v_attendee is null then
    select *
      into v_attendee
      from public.attendees
     where event_id = p_event_id and user_id = auth.uid();
  end if;

  return v_attendee;
end $$;

-- ----------------------------------------------------------------------------
-- 2. SPEND CREDITS — deducts p_amount from the caller's balance for an event,
--    guarded so the balance can never go negative. Null when not enough.
-- ----------------------------------------------------------------------------
drop function if exists public.spend_attendee_credits(p_event_id uuid, p_amount numeric);
create or replace function public.spend_attendee_credits(p_event_id uuid, p_amount numeric)
returns public.attendees
language plpgsql security definer volatile set search_path = public
as $$
declare
  v_updated public.attendees;
begin
  if p_event_id is null or auth.uid() is null or p_amount is null or p_amount < 0 then
    return null;
  end if;

  update public.attendees
     set credit_balance = credit_balance - p_amount
   where event_id = p_event_id
     and user_id = auth.uid()
     and credit_balance >= p_amount
  returning * into v_updated;

  return v_updated;
end $$;

-- ----------------------------------------------------------------------------
-- 3. DASHBOARD DATA — every event the caller joined (regardless of status,
--    RLS on events only exposes live ones), with their balance, credits spent
--    and songs requested per event. Security definer so history survives
--    an event being ended.
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
    coalesce(sum(r.credits) filter (where r.status in ('pending', 'approved', 'playing', 'played')), 0)::numeric as spent,
    count(r.id) filter (where r.status in ('pending', 'approved', 'playing', 'played'))::bigint as songs
  from public.attendees a
  join public.events e on e.id = a.event_id
  left join public.requests r on r.event_id = a.event_id and r.user_id = a.user_id
  where a.user_id = auth.uid()
  group by a.event_id, e.code, e.name, e.act, e.event_date, e.status, e.palette, a.credit_balance, a.created_at
  order by a.created_at desc
$$;