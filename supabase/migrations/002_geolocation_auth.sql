-- Project One — Connect & Collab · v2 migration
-- Adds (1) proximity coordinates on profiles and (2) real-auth linkage.
-- Run in the Supabase SQL editor AFTER schema.sql. Safe to re-run (idempotent).

-- ---------- (1) geolocation ----------
-- Real browser geolocation stores the visitor's coordinates so "people nearby"
-- can be ranked by actual distance. Optional per row — seeded demo profiles
-- have none and simply sort last, so nothing breaks if this is empty.
alter table profiles add column if not exists lat  double precision;
alter table profiles add column if not exists lng  double precision;

-- ---------- (2) real auth linkage ----------
-- Ties a profile to a Supabase Auth user. Nullable so the pre-auth demo rows
-- (created via the old localStorage flow) keep working; new sign-ups set it.
alter table profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists idx_profiles_user on profiles(user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- (3) OPTIONAL — tighten RLS to the signed-in user.  DO NOT run this until you
-- have confirmed the email-OTP sign-in flow works end to end in the browser.
-- If applied while auth is misconfigured it will lock every visitor out, so it
-- is intentionally left commented. The permissive demo_all policy from
-- schema.sql stays in effect until you opt in here.
--
--   -- profiles: anyone can read the directory; you may only write your own row
--   drop policy if exists demo_all on profiles;
--   create policy profiles_read   on profiles for select using (true);
--   create policy profiles_write  on profiles for insert with check (auth.uid() = user_id);
--   create policy profiles_update on profiles for update using (auth.uid() = user_id);
--
--   -- connections / messages: you may only act as a profile you own
--   drop policy if exists demo_all on connections;
--   create policy conn_read  on connections for select using (true);
--   create policy conn_write on connections for insert
--     with check (from_profile in (select id from profiles where user_id = auth.uid()));
--   create policy conn_update on connections for update
--     using (to_profile in (select id from profiles where user_id = auth.uid())
--         or from_profile in (select id from profiles where user_id = auth.uid())));
--
--   drop policy if exists demo_all on messages;
--   create policy msg_read  on messages for select using (true);
--   create policy msg_write on messages for insert
--     with check (sender_profile in (select id from profiles where user_id = auth.uid()));
-- ---------------------------------------------------------------------------
