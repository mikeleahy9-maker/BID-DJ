-- ----------------------------------------------------------------------------
-- Guests need a live "Guests Bidding" read on the event landing page:
-- allow authenticated guests to count attendees of live events.
-- (requests were already readable via requests_select_public.)
-- ----------------------------------------------------------------------------

alter table public.attendees enable row level security;

drop policy if exists "attendees_select_live" on public.attendees;
create policy "attendees_select_live" on public.attendees
  for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.status = 'live'
  ));