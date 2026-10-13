-- ----------------------------------------------------------------------------
-- Guest tips → DJ/Band.
--
-- A tip is a plain platform charge, but unlike a credit purchase its whole
-- value belongs to the performer (no 70/20/10 split). The DJ receives the tip
-- MINUS the Stripe processing fee, so each row has to carry the same payout
-- bookkeeping an event settlement leg does: the PaymentIntent, the fee read
-- back from Stripe, the transfer that pays it out, and a status that records
-- what is known about the money.
--
-- The table was created in the initial schema but never used; only its status
-- vocabulary and columns are extended here. The old vocabulary
-- (held/released/refunded) is replaced with the settlement-leg vocabulary so a
-- tip and a settlement leg can be reasoned about the same way:
--
--   pending  booked, not paid out yet (waiting on funds or first attempt)
--   held     Stripe did not send it: not funded yet, or recipient not ready
--   sent     the transfer exists, or there was nothing left after the fee
--   failed   Stripe rejected it for a reason that needs a person
-- ----------------------------------------------------------------------------
alter table public.tips
  add column if not exists dj_id uuid references public.profiles(id) on delete set null,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists fee_cents integer not null default 0,
  add column if not exists stripe_transfer_id text,
  add column if not exists failure_reason text,
  add column if not exists attempt integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Fold any legacy status onto the new vocabulary before the constraint moves,
-- so the swap cannot fail on a pre-existing row.
update public.tips
   set status = 'pending'
 where status not in ('pending', 'held', 'sent', 'failed');

alter table public.tips drop constraint if exists tips_status_check;
alter table public.tips
  add constraint tips_status_check
  check (status in ('pending', 'held', 'sent', 'failed'));
alter table public.tips alter column status set default 'pending';

-- One transfer per PaymentIntent. `fee_cents = 0` marks "fee not read yet",
-- mirroring credit_purchases; the DJ's read-back fee replaces it on success.
create unique index if not exists tips_stripe_payment_intent_id_key
  on public.tips (stripe_payment_intent_id);

-- Live list + payout sweep both walk tips by event, newest first / oldest first.
create index if not exists tips_event_id_created_at_idx
  on public.tips (event_id, created_at desc);
create index if not exists tips_payout_status_idx
  on public.tips (status)
  where status in ('pending', 'held');

-- ----------------------------------------------------------------------------
-- record_tip: books a paid tip exactly once per PaymentIntent.
--
-- Called inline by /api/guest/tip right after the charge succeeds AND by the
-- payment_intent.succeeded webhook, both keyed on the intent id, so whichever
-- arrives second inserts nothing. dj_id is snapshotted from the event at insert
-- time; the payout sweep resolves the live account later, so a tip is not lost
-- if the event's DJ link changes.
-- ----------------------------------------------------------------------------
create or replace function public.record_tip(
  p_event_id uuid,
  p_user_id uuid,
  p_nickname text,
  p_amount_cents integer,
  p_message text,
  p_stripe_payment_intent_id text
)
returns public.tips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tip public.tips;
  v_dj_id uuid;
begin
  if p_event_id is null or p_user_id is null
     or p_stripe_payment_intent_id is null or p_stripe_payment_intent_id = ''
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid tip arguments';
  end if;

  select e.dj_id into v_dj_id
    from public.events e
   where e.id = p_event_id;

  insert into public.tips (
    event_id, user_id, dj_id, nickname, amount_cents, message,
    stripe_payment_intent_id, status
  )
  values (
    p_event_id,
    p_user_id,
    v_dj_id,
    nullif(btrim(coalesce(p_nickname, '')), ''),
    p_amount_cents,
    nullif(btrim(coalesce(p_message, '')), ''),
    p_stripe_payment_intent_id,
    'pending'
  )
  on conflict (stripe_payment_intent_id) do nothing
  returning * into v_tip;

  if v_tip.id is null then
    select * into v_tip
      from public.tips
     where stripe_payment_intent_id = p_stripe_payment_intent_id;
  end if;

  return v_tip;
end;
$$;

revoke execute on function
  public.record_tip(uuid, uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function
  public.record_tip(uuid, uuid, text, integer, text, text)
  to service_role;

-- ----------------------------------------------------------------------------
-- Realtime: the DJ's live tip feed watches this table. RLS decides delivery
-- (tips_select_own_dj grants the DJ, user_id = auth.uid() grants the guest), so
-- the DJ sees only their own event's tips and a guest sees only their own tip.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tips'
  ) then
    alter publication supabase_realtime add table public.tips;
  end if;
end $$;

