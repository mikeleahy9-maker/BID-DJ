-- ----------------------------------------------------------------------------
-- DJ profile details — bio, tags and city for the public DJ profile.
--
--   · description — free-text bio shown on the DJ's profile
--   · tags        — up to 5 short genre/vibe tags (e.g. House, 90s, Deep)
-- city and avatar_url already exist on profiles (from initial schema); the
-- profile photo continues to be stored in avatar_url.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}';

-- Keep the existing updated_at trigger happy on every profile write.
-- (profiles_set_updated_at already fires on update; nothing to add here.)
