-- ============================================================================
-- AUTO-CLOSE WARNING EMAILS
--
-- Companions to 20261013000002_auto_close_events.sql: a DJ whose event is still
-- live 30 hours after it went live gets one email, ~6 hours before the 36-hour
-- auto-close, so they can end it themselves instead of finding it closed.
--
-- auto_close_warned_at records that the email went out, so the hourly sweep
-- does not send it once per hour for six hours. It is left in place after the
-- event ends (the event can never go back to live), so it also stops a warning
-- for an event that was already manually closed.
-- ============================================================================

alter table public.events
  add column if not exists auto_close_warned_at timestamptz;

comment on column public.events.auto_close_warned_at is
  'When the "your event is still live" warning email was sent (30h into a live event). Null = not warned.';

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('bidabeat-auto-close-warning')
 where exists (select 1 from cron.job where jobname = 'bidabeat-auto-close-warning');

-- Hourly, on a minute offset away from the settle (:00) and auto-close (:15)
-- jobs. The pg_cron job only TRIGGERS the sweep; the app decides who is due.
select cron.schedule(
  'bidabeat-auto-close-warning',
  '45 * * * *',
  'select net.http_post(
    url := ''https://bidabeat.vercel.app/api/cron/auto-close-warning'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer 1b0202a12b3a6b08074bd82d63027c9ac8f894d70deded1f4055aafcabf9b977''
    ),
    body := ''{}''
  )'
);
