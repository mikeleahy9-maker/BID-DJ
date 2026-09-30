-- ----------------------------------------------------------------------------
-- Public DJ profile pages.
--
-- Every DJ gets a stable public URL (/dj-profile/<slug>). Two problems had to be
-- solved to make that work:
--
--   1. `profiles` has no shareable identifier. The `id` is a uuid, which is
--      stable but ugly in a link people are meant to share, and it would leak
--      the auth user id. So each DJ gets a `public_slug` derived from their act
--      name, with a numeric suffix when that name is already taken.
--
--   2. RLS. The `profiles_select_own` policy only lets a row's owner (or an
--      admin) read it, so a signed-out visitor cannot read a DJ's profile at
--      all. Rather than loosening that policy -- which would expose every
--      guest's email and phone number to the public -- this adds a
--      SECURITY DEFINER function that returns ONLY the columns that are meant
--      to be public. The table's own policies stay exactly as strict as they
--      were.
-- ----------------------------------------------------------------------------

-- 1. Stable public slug --------------------------------------------------------

alter table public.profiles
  add column if not exists public_slug text;

create unique index if not exists profiles_public_slug_key
  on public.profiles (public_slug)
  where public_slug is not null;

-- Turn an arbitrary name into a URL-safe slug fragment.
create or replace function public.slugify_dj_name(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'dj'
  );
$$;

-- Pick a slug that is not already used by another profile.
-- Uses the caller-supplied id so a re-run on the same row is idempotent.
create or replace function public.unique_dj_slug(p_name text, p_owner_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := public.slugify_dj_name(p_name);
  v_slug text;
  v_n    int;
begin
  v_slug := v_base;
  v_n    := 0;

  while exists (
    select 1 from public.profiles
    where public_slug = v_slug
      and (p_owner_id is null or id <> p_owner_id)
  ) loop
    v_n    := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  return v_slug;
end;
$$;

-- Give every DJ a slug. Runs on signup (the profiles row is created by the
-- handle_new_user trigger) and again whenever the act name changes, so a DJ
-- who renames themselves keeps the URL they have already shared.
create or replace function public.assign_dj_public_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'dj' and (new.public_slug is null or new.public_slug = '') then
    new.public_slug := public.unique_dj_slug(
      coalesce(nullif(new.act_name, ''), nullif(new.display_name, ''), nullif(new.first_name, '')),
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_public_slug on public.profiles;
create trigger profiles_assign_public_slug
  before insert or update of act_name, display_name, first_name, role
  on public.profiles
  for each row execute function public.assign_dj_public_slug();

-- Backfill existing DJs that predate this column.
update public.profiles
set public_slug = public.unique_dj_slug(
  coalesce(nullif(act_name, ''), nullif(display_name, ''), nullif(first_name, '')),
  id
)
where role = 'dj' and (public_slug is null or public_slug = '');

-- 2. Public read path ---------------------------------------------------------

-- Returns ONLY public-facing DJ data. Deliberately excludes email, phone,
-- stripe ids, activation state and every other sensitive column on profiles.
create or replace function public.public_dj_profile(p_slug text)
returns table (
  slug         text,
  act_name     text,
  display_name text,
  description  text,
  city         text,
  tags         text[],
  avatar_url   text,
  member_since timestamptz,
  events       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.public_slug,
    coalesce(nullif(p.act_name, ''), nullif(p.display_name, ''), 'DJ'),
    p.display_name,
    p.description,
    p.city,
    coalesce(p.tags, '{}'::text[]),
    p.avatar_url,
    p.created_at,
    coalesce(
      (
        select jsonb_agg(ev order by
          (ev.status = 'live') desc nulls last,
          ev.event_date desc nulls last,
          ev.created_at desc
        )
        from (
          select
            e.id,
            e.name,
            e.act,
            e.event_date,
            e.event_time,
            e.venue,
            e.city,
            e.palette,
            e.status,
            e.created_at
          from public.events e
          where e.dj_id = p.id
            and e.status in ('live', 'ended')
          order by
            case e.status when 'live' then 0 else 1 end,
            e.event_date desc nulls last,
            e.created_at desc
          limit 12
        ) ev
      ),
      '[]'::jsonb
    )
  from public.profiles p
  where p.public_slug = p_slug
    and p.role = 'dj'
  limit 1;
$$;

revoke all on function public.public_dj_profile(text) from public;
grant execute on function public.public_dj_profile(text) to anon, authenticated;
