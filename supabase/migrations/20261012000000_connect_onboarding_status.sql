-- ----------------------------------------------------------------------------
-- Mirror Stripe Connect onboarding state onto dj_owner_profiles.
--
-- Until now only `stripe_connect_id` was stored and onboarding state was
-- re-queried live from Stripe on every read. That works for a single lookup but
-- leaves the database unable to answer "is this DJ onboarded / when / closed"
-- without a Stripe round-trip, and it is asymmetric with organizations, which
-- already carries `status` + `onboarded_at`. This adds the same mirrored state,
-- maintained by the v2 account webhooks and reconciled on read.
--
-- `connect_status`:
--   not_started - no Connect account yet
--   pending     - account exists, Stripe onboarding not complete
--   onboarded   - balance + transfers capabilities active, ready to be paid
--   suspended   - account closed
-- ----------------------------------------------------------------------------
alter table public.dj_owner_profiles
  add column if not exists connect_status text not null default 'not_started'
    check (connect_status in ('not_started', 'pending', 'onboarded', 'suspended')),
  add column if not exists connect_onboarded_at timestamptz,
  add column if not exists connect_updated_at timestamptz;

-- Any row that already has an account predates this column and is at least
-- 'pending'; the next webhook (or a status read) corrects it to the live state.
update public.dj_owner_profiles
   set connect_status = 'pending'
 where stripe_connect_id is not null
   and connect_status = 'not_started';
