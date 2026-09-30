-- ----------------------------------------------------------------------------
-- Guest dashboard "Credits Spent" now includes bids.
--
-- Previously `spent` summed only requests.credits (2 per song request), so a
-- guest who mostly bids saw a fraction of their true spend. Credits actually
-- leave the wallet two ways:
--   · song requests — requests.credits (pending/approved/playing/played; a
--     rejected request is excluded)
--   · up/down bids  — current stake rows in `bids`.amount
-- Refunded songs cascade their bids away and credit the balance back, so the
-- live `bids` table already reflects only what is still committed.
--
-- Requests, bids and purchases are pre-aggregated per (event, user) and joined
-- back 1:1, so the two spend sums never cross multiply.
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
    (
      coalesce(req.spent, 0) + coalesce(b.spent, 0)
    )::numeric as spent,
    coalesce(req.songs, 0)::bigint as songs
  from public.attendees a
  join public.events e on e.id = a.event_id
  left join (
    select r.event_id, r.user_id,
           sum(r.credits) filter (
             where r.status in ('pending', 'approved', 'playing', 'played')
           )::numeric as spent,
           count(r.id) filter (
             where r.status in ('pending', 'approved', 'playing', 'played')
           )::bigint as songs
      from public.requests r
     group by r.event_id, r.user_id
  ) req on req.event_id = a.event_id and req.user_id = a.user_id
  left join (
    select b.event_id, b.user_id, sum(b.amount)::numeric as spent
      from public.bids b
     group by b.event_id, b.user_id
  ) b on b.event_id = a.event_id and b.user_id = a.user_id
  left join (
    select event_id, user_id, sum(revenue_cents)::numeric / 100 as purchased
      from public.credit_purchases
     group by event_id, user_id
  ) cp on cp.event_id = a.event_id and cp.user_id = a.user_id
  where a.user_id = auth.uid()
  order by a.created_at desc
$$;