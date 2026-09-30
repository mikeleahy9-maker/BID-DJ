-- ----------------------------------------------------------------------------
-- Look a DJ's public profile up by their user id.
--
-- Guest-facing screens (e.g. the event landing page's "Hire this DJ" card)
-- start from an event row and therefore know `events.dj_id`, not the public
-- slug. This wraps the same SECURITY DEFINER public projection so those
-- screens can render the DJ's real public details without being able to read
-- the profiles table directly.
-- ----------------------------------------------------------------------------
create or replace function public.public_dj_profile_by_id(p_dj_id uuid)
returns table (
  slug         text,
  act_name     text,
  display_name text,
  description  text,
  city         text,
  tags         text[],
  avatar_url   text,
  member_since timestamptz
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
    p.created_at
  from public.profiles p
  where p.id = p_dj_id
    and p.role = 'dj'
  limit 1;
$$;

revoke all on function public.public_dj_profile_by_id(uuid) from public;
grant execute on function public.public_dj_profile_by_id(uuid) to anon, authenticated;
