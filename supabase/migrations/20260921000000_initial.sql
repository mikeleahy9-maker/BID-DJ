-- ============================================================================
-- BidaBeat Database Schema (Supabase / PostgreSQL)
--
-- Regenerated schema for the BidaBeat DJ + Guest app.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Safe to run on a fresh project AND on an existing project:
-- tables are CREATE IF NOT EXISTS, functions are CREATE OR REPLACE,
-- enums / publications / new columns are guarded.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('guest', 'dj', 'helper');
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role public.user_role not null default 'guest',
  email text,
  first_name text,
  last_name text,
  act_name text,
  display_name text,
  city text,
  phone text,
  avatar_url text,
  -- Activation / Stripe
  activated boolean not null default false,
  activation_intent_id text,
  activation_paid_at timestamptz
);

-- Additive columns for existing installs
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists act_name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists activated boolean not null default false;
alter table public.profiles add column if not exists activation_intent_id text;
alter table public.profiles add column if not exists activation_paid_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3. ADMIN PLATFORM REVIEWERS
-- ----------------------------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. DJ OWNERSHIP & HELPER MEMBERSHIPS
-- ----------------------------------------------------------------------------
create table if not exists public.dj_owner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_connect_id text,
  payout_rate numeric(4,3) not null default 0.200,
  created_at timestamptz not null default now()
);

create table if not exists public.dj_memberships (
  id uuid primary key default gen_random_uuid(),
  dj_owner_id uuid not null references public.profiles(id) on delete cascade,
  helper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dj_owner_id, helper_id)
);

-- ----------------------------------------------------------------------------
-- 5. EVENTS (gigs)
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  act text,
  description text,
  event_date date,
  event_time time,
  venue text,
  city text,
  code text not null unique,
  pin text,
  helper_pin text,
  palette text not null default 'noir',
  logo_url text,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'ended', 'canceled')),
  payout_rate numeric(4,3) default 0.200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. EVENT TRACK LIST (song seeding at event creation)
-- ----------------------------------------------------------------------------
create table if not exists public.event_tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  artist text not null,
  added_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. LIVE QUEUE REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  nickname text,
  song_title text not null,
  song_artist text,
  tip_amount numeric(10,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'playing', 'played', 'skipped')),
  requested_at timestamptz not null default now(),
  played_at timestamptz
);

-- ----------------------------------------------------------------------------
-- 8. ATTENDEES (join rows, keeps profiles clean)
-- ----------------------------------------------------------------------------
create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 9. TIPS
-- ----------------------------------------------------------------------------
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  nickname text,
  amount_cents integer not null,
  message text,
  status text not null default 'held'
    check (status in ('held', 'released', 'refunded')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. TRANSACTIONS (fee payments, tipping ledger)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('dj_activation_fee', 'tip', 'payout')),
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_intent_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists transactions_stripe_intent_unique
  on public.transactions (stripe_intent_id) where stripe_intent_id is not null;

-- ----------------------------------------------------------------------------
-- 11. DJ PAYOUTS
-- ----------------------------------------------------------------------------
create table if not exists public.dj_payouts (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  amount_cents integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed')),
  stripe_payout_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ============================================================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================================================

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Create a profile whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r public.user_role := coalesce((meta->>'role')::public.user_role, 'guest');
begin
  insert into public.profiles (id, email, role, first_name, last_name, act_name, display_name, city)
  values (
    new.id,
    new.email,
    r,
    nullif(meta->>'first_name', ''),
    nullif(meta->>'last_name', ''),
    nullif(meta->>'act_name', ''),
    coalesce(nullif(meta->>'act_name', ''), meta->>'display_name'),
    nullif(meta->>'city', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check (platform payout reviewers).
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.admins a where a.id = auth.uid());
$$;

-- True when the requesting user is the event's DJ or an approved helper.
create or replace function public.is_event_dj(p_event_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and ( e.dj_id = auth.uid()
         or e.created_by = auth.uid()
         or exists (select 1 from public.dj_memberships m
                    where m.dj_owner_id = e.dj_id and m.helper_id = auth.uid())
      )
  );
$$;

-- Marks a DJ activation fee as paid (called by the Stripe webhook).
create or replace function public.mark_dj_fee_paid(p_user_id uuid, p_intent_id text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
     set activated = true,
         activation_intent_id = coalesce(nullif(p_intent_id, ''), activation_intent_id),
         activation_paid_at = coalesce(activation_paid_at, now())
   where id = p_user_id;

  insert into public.transactions (user_id, type, amount_cents, currency, status, stripe_intent_id)
  values (p_user_id, 'dj_activation_fee', 5000, 'usd', 'paid', nullif(p_intent_id, ''))
  on conflict do nothing;
end $$;

-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================================

alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.dj_owner_profiles enable row level security;
alter table public.dj_memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_tracks enable row level security;
alter table public.requests enable row level security;
alter table public.attendees enable row level security;
alter table public.tips enable row level security;
alter table public.transactions enable row level security;
alter table public.dj_payouts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admins_select" on public.admins;
create policy "admins_select" on public.admins
  for select using (public.is_admin());

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select using (dj_id = auth.uid() or created_by = auth.uid() or public.is_admin());

drop policy if exists "events_select_live" on public.events;
create policy "events_select_live" on public.events
  for select using (status = 'live');

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
  for insert with check (dj_id = auth.uid() or public.is_admin());

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own" on public.events
  for update using (dj_id = auth.uid() or public.is_admin())
  with check (dj_id = auth.uid() or public.is_admin());

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own" on public.events
  for delete using (dj_id = auth.uid() or public.is_admin());

drop policy if exists "event_tracks_select" on public.event_tracks;
create policy "event_tracks_select" on public.event_tracks
  for select using (public.is_event_dj(event_id));

drop policy if exists "event_tracks_insert" on public.event_tracks;
create policy "event_tracks_insert" on public.event_tracks
  for insert with check (public.is_event_dj(event_id));

drop policy if exists "requests_select_public" on public.requests;
create policy "requests_select_public" on public.requests
  for select using (true);

drop policy if exists "requests_insert_authenticated" on public.requests;
create policy "requests_insert_authenticated" on public.requests
  for insert with check (auth.uid() is not null);

drop policy if exists "requests_update_dj" on public.requests;
create policy "requests_update_dj" on public.requests
  for update using (public.is_event_dj(event_id));

drop policy if exists "attendees_select_self_dj" on public.attendees;
create policy "attendees_select_self_dj" on public.attendees
  for select using (user_id = auth.uid() or public.is_event_dj(event_id));

drop policy if exists "attendees_insert_self" on public.attendees;
create policy "attendees_insert_self" on public.attendees
  for insert with check (user_id = auth.uid());

drop policy if exists "attendees_update_dj" on public.attendees;
create policy "attendees_update_dj" on public.attendees
  for update using (public.is_event_dj(event_id));

drop policy if exists "tips_select_own_dj" on public.tips;
create policy "tips_select_own_dj" on public.tips
  for select using (user_id = auth.uid() or public.is_event_dj(event_id));

drop policy if exists "tips_insert_self" on public.tips;
create policy "tips_insert_self" on public.tips
  for insert with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "dj_payouts_select_own" on public.dj_payouts;
create policy "dj_payouts_select_own" on public.dj_payouts
  for select using (dj_id = auth.uid() or public.is_admin());

drop policy if exists "dj_owner_profiles_select_own" on public.dj_owner_profiles;
create policy "dj_owner_profiles_select_own" on public.dj_owner_profiles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "dj_owner_profiles_update_own" on public.dj_owner_profiles;
create policy "dj_owner_profiles_update_own" on public.dj_owner_profiles
  for update using (user_id = auth.uid());

drop policy if exists "dj_memberships_select" on public.dj_memberships;
create policy "dj_memberships_select" on public.dj_memberships
  for select using (dj_owner_id = auth.uid() or helper_id = auth.uid());

drop policy if exists "dj_memberships_insert_owner" on public.dj_memberships;
create policy "dj_memberships_insert_owner" on public.dj_memberships
  for insert with check (dj_owner_id = auth.uid());

-- ============================================================================
-- 14. REALTIME (live queue / attendees)
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.events;
  alter publication supabase_realtime add table public.requests;
  alter publication supabase_realtime add table public.attendees;
exception when duplicate_object or others then null;
end $$;