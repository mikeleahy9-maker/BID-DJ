-- ----------------------------------------------------------------------------
-- Support off-session charging against the guest's saved card.
--
-- Guests already save a card at signup (SetupIntent -> profiles
-- .stripe_payment_method_id), so buying credits no longer needs a redirect to
-- hosted Checkout. The server confirms a PaymentIntent off-session against the
-- saved payment method instead.
--
-- The idempotency key changes here, and it matters:
--   record_credit_purchase() was keyed on stripe_session_id ("cs_..."), which
--   only exists for Checkout sessions. A PaymentIntent is "pi_...", so that key
--   cannot express the new flow.
--
-- Both flows now key on the PAYMENT INTENT id. A Checkout purchase and its
-- underlying PaymentIntent therefore share one key, so whichever webhook
-- arrives first records the sale and the second is a no-op. Keying the two
-- flows differently would have double-credited any purchase that produced both
-- events.
-- ----------------------------------------------------------------------------
alter table public.credit_purchases
  add column if not exists stripe_reference text;

update public.credit_purchases
   set stripe_reference = stripe_session_id
 where stripe_reference is null and stripe_session_id is not null;

create unique index if not exists credit_purchases_stripe_reference_key
  on public.credit_purchases (stripe_reference);

-- The Checkout-only key is no longer the source of truth. It stays for
-- traceability of older rows, but must be nullable now that an off-session
-- purchase has no session.
alter table public.credit_purchases
  alter column stripe_session_id drop not null;

alter table public.credit_purchases
  drop constraint if exists credit_purchases_stripe_session_id_key;

-- Guarded: this migration may be re-run after a partial apply, and a bare
-- ADD CONSTRAINT has no IF NOT EXISTS form.
do $$ begin
  alter table public.credit_purchases
    add constraint credit_purchases_stripe_reference_present
    check (stripe_reference is not null);
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Re-keyed grant function. Identical behaviour to the previous version, with
-- stripe_reference replacing stripe_session_id as the idempotency key.
--
-- DROPped rather than replaced: Postgres refuses to rename an input parameter
-- via CREATE OR REPLACE (SQLSTATE 42P13). The only caller is the webhook,
-- which is updated in the same change.
-- ----------------------------------------------------------------------------
drop function if exists public.record_credit_purchase(
  uuid, uuid, text, text, integer, integer
);
create or replace function public.record_credit_purchase(
  p_event_id uuid,
  p_user_id uuid,
  p_stripe_reference text,
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
     or p_stripe_reference is null or p_stripe_reference = ''
     or p_credits_granted is null or p_credits_granted <= 0
     or p_revenue_cents is null or p_revenue_cents <= 0 then
    raise exception 'invalid credit purchase arguments';
  end if;

  select organization_id into v_organization_id
    from public.events where id = p_event_id;

  insert into public.credit_purchases (
    event_id, user_id, organization_id, stripe_reference, stripe_session_id,
    stripe_payment_intent_id, credits_granted, revenue_cents
  )
  values (
    p_event_id, p_user_id, v_organization_id, p_stripe_reference,
    case when p_stripe_reference like 'cs_%' then p_stripe_reference else null end,
    nullif(p_stripe_payment_intent_id, ''), p_credits_granted, p_revenue_cents
  )
  on conflict (stripe_reference) do nothing
  returning * into v_purchase;

  -- Replay: already recorded, so return the original row and do not re-grant.
  if v_purchase is null then
    select * into v_purchase
      from public.credit_purchases
     where stripe_reference = p_stripe_reference;
    return v_purchase;
  end if;

  -- Upsert: a plain UPDATE matches zero rows when the attendee row is missing
  -- and raises nothing, banking a real payment with no credits granted.
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
