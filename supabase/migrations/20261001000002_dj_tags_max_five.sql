-- ----------------------------------------------------------------------------
-- Enforce the 5-tag limit at the database level.
--
-- The API caps tags in application code, but the profiles_update_own RLS
-- policy lets a signed-in user write their own row straight from the browser
-- client. This CHECK makes the 5-tag limit a real invariant rather than a
-- convention that only the PATCH /api/dj/profile route upholds.
-- ----------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_tags_max_five;

alter table public.profiles
  add constraint profiles_tags_max_five check (cardinality(tags) <= 5);
