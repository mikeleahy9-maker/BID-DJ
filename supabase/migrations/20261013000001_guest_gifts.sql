-- ----------------------------------------------------------------------------
-- Guest credits gifting: a guest can donate their remaining credits to an event.
-- The credits are deducted from the giver's balance and recorded as a gift.
-- No recipient balance is increased — this is a pure donation to the event.
-- ----------------------------------------------------------------------------

create table if not exists public.guest_gifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  giver_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  message text,
  created_at timestamptz not null default now()
);

-- Index for event-level gift summaries
create index if not exists guest_gifts_event_id_created_at_idx
  on public.guest_gifts (event_id, created_at desc);

-- Index for giver history
create index if not exists guest_gifts_giver_id_created_at_idx
  on public.guest_gifts (giver_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RPC: gift credits to an event. Deducts from the caller's attendee balance,
-- inserts a gift record. Returns the updated attendee row or null on failure.
-- ----------------------------------------------------------------------------
drop function if exists public.gift_attendee_credits(p_event_id uuid, p_amount numeric, p_message text);
create or replace function public.gift_attendee_credits(
  p_event_id uuid,
  p_amount numeric,
  p_message text default null
)
returns public.attendees
language plpgsql security definer volatile set search_path = public
as $$
declare
  v_updated public.attendees;
  v_message text;
begin
  if p_event_id is null or auth.uid() is null or p_amount is null or p_amount <= 0 then
    return null;
  end if;

  v_message := nullif(trim(coalesce(p_message, '')), '');

  -- Deduct credits and capture the updated row
  update public.attendees
     set credit_balance = credit_balance - p_amount
   where event_id = p_event_id
     and user_id = auth.uid()
     and credit_balance >= p_amount
   returning * into v_updated;

  if not found then
    return null;
  end if;

  -- Record the gift
  insert into public.guest_gifts (event_id, giver_id, amount, message)
  values (p_event_id, auth.uid(), p_amount, v_message);

  return v_updated;
end $$;

grant execute on function public.gift_attendee_credits(uuid, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS: guests can read gifts for live events they're attending.
-- ----------------------------------------------------------------------------
alter table public.guest_gifts enable row level security;

drop policy if exists "guest_gifts_select_live" on public.guest_gifts;
create policy "guest_gifts_select_live" on public.guest_gifts
  for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.status = 'live'
  ));

drop policy if exists "guest_gifts_select_own" on public.guest_gifts;
create policy "guest_gifts_select_own" on public.guest_gifts
  for select to authenticated
  using (giver_id = auth.uid());