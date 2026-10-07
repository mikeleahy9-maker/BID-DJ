-- ============================================================================
-- EVENT SETTLEMENT
--
-- When a DJ ends a live event, the revenue sitting in the PLATFORM Stripe
-- balance is split three ways (70% organizer / 20% DJ / 10% platform by default,
-- per events.organizer_rate and events.payout_rate) and moved out to the
-- connected accounts with stripe.transfers.
--
-- event_finance() is the source of truth for the numbers; this table is the
-- durable record of what was actually attempted and sent. Without it a retried
-- end-event would re-transfer money, and there would be no audit trail for
-- "why did the organizer only get $41.10".
-- ============================================================================

create table if not exists public.event_settlements (
  id uuid primary key default gen_random_uuid(),
  -- One settlement per event: this is the idempotency anchor. A second attempt
  -- to settle the same event hits the unique violation instead of transferring
  -- a second time.
  event_id uuid not null unique references public.events(id) on delete cascade,
  dj_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,

  total_revenue_cents bigint not null default 0,
  dj_rate numeric(4,3) not null,
  organizer_rate numeric(4,3) not null,
  platform_rate numeric(4,3) not null,

  -- Where the money went. Kept on the settlement rather than re-read from
  -- organizations, so the record still says who was paid if the org later
  -- changes accounts.
  organization_stripe_account_id text,

  organizer_cents bigint not null default 0,
  dj_cents bigint not null default 0,
  platform_cents bigint not null default 0,

  -- Per-recipient outcome:
  --   pending -> a transfer was started but its result was never recorded
  --             (crashed mid-call); the only state where we cannot tell
  --             whether Stripe already sent the money
  --   held    -> recipient's account isn't activated yet, Stripe was never
  --             called, funds stay on the platform until they onboard
  --   failed  -> Stripe rejected the transfer
  --   sent    -> transfer created (or there was nothing to send)
  organizer_status text not null default 'pending'
    check (organizer_status in ('pending', 'held', 'sent', 'failed')),
  organizer_transfer_id text,
  organizer_failure_reason text,
  -- Number of Stripe calls started for this leg. Persisted BEFORE the call and
  -- advanced only by starting another, so `attempt + 1` is always the next
  -- unused idempotency key -- which is what lets a retry either dedupe a
  -- transfer that already went out or issue a genuinely fresh one.
  organizer_attempt int not null default 0,

  dj_status text not null default 'pending'
    check (dj_status in ('pending', 'held', 'sent', 'failed')),
  dj_transfer_id text,
  dj_failure_reason text,
  dj_attempt int not null default 0,

  status text not null default 'in_progress'
    check (status in ('in_progress', 'settled', 'partial')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_settlements_dj_id_idx
  on public.event_settlements (dj_id);

alter table public.event_settlements enable row level security;

-- The DJ who owns the event can read its settlement. Helpers, guests and other
-- DJs see nothing (no select policy for them).
drop policy if exists "event_settlements_select_own" on public.event_settlements;
create policy "event_settlements_select_own"
  on public.event_settlements
  for select to authenticated
  using (dj_id = auth.uid());

-- Settlement rows are written by the API through the service role only, so no
-- insert/update/delete policies are defined. Reads are enforced by the policy
-- above, which is what the end-event endpoint relies on to prove ownership.

-- Guard the DJ-facing payout row: one payout per event, so a retry can never
-- create a second row. Deliberately NOT a partial index -- Postgres unique
-- indexes already treat NULLs as distinct (events without a payout row stay
-- legal), and ON CONFLICT (event_id) inference used by upsert() only matches an
-- unqualified unique index. The table is empty before this migration.
create unique index if not exists dj_payouts_event_id_key
  on public.dj_payouts (event_id);
