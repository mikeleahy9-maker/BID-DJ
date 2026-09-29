-- ----------------------------------------------------------------------------
-- Fix: record_credit_purchase() recorded a real payment in the ledger without
-- granting the guest any credits.
--
-- It granted with a plain
--     update attendees set credit_balance = credit_balance + n
--     where event_id = ... and user_id = ...
-- which matches ZERO rows when the attendee row is absent -- and Postgres
-- raises nothing. So a guest could pay, get a correct credit_purchases row,
-- and keep a balance of 0. Ledger and balance silently diverge, which is the
-- worst failure mode for a money path: the money is real, the credit is not.
--
-- An INSERT ... ON CONFLICT DO UPDATE fixes it: the row is created if missing
-- and topped up if present, and either way exactly the granted amount is added.
--
-- The conflict branch is safe to run on rows that already exist, and the replay
-- guard above it still returns early for a repeated stripe_session_id, so this
-- cannot double-credit.
-- ----------------------------------------------------------------------------
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

  -- Replay: this session was already recorded, so return the existing row and
  -- do NOT grant credits a second time.
  if v_purchase is null then
    select * into v_purchase
      from public.credit_purchases
     where stripe_session_id = p_stripe_session_id;
    return v_purchase;
  end if;

  -- Upsert rather than update: a plain UPDATE matches zero rows when the
  -- attendee row is missing and raises nothing, which would bank a real
  -- payment while granting no credits.
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
