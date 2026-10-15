-- ============================================================================
-- ORGANIZER SETTLEMENT NOTIFICATION
--
-- Records when we emailed an organizer that their share of an event was sent to
-- their Stripe Express account.
--
-- The settlement sweep (retryOutstandingSettlements) is idempotent and re-runs
-- on a schedule and on Stripe webhooks, so it can observe the same organizer leg
-- flipping to 'sent' more than once. `organizer_notified_at` is the guard: the
-- sweep claims the row with a conditional update (only when this column is NULL)
-- before sending, and clears it again if the send fails, so an organizer is
-- emailed at most once per settlement while a transient failure can still retry.
-- ============================================================================

alter table public.event_settlements
  add column if not exists organizer_notified_at timestamptz;
