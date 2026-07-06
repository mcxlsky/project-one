-- Project One — Connect & Collab · v1 schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor (SQL → New query → paste → Run).
-- Handle-only identity for the demo: there is no Supabase Auth here, so RLS
-- is intentionally permissive (anon can read/write). NOT production-secure —
-- round two adds real auth + tight policies.

-- ---------- tables ----------

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  subtitle   text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  handle     text not null,
  name       text not null,
  category   text not null,          -- Design | Photography | Writing | Development
  service    text not null,          -- e.g. "Visual identity"
  blurb      text,
  wants      text,                   -- the Classifieds "wants to build" line
  avatar_url text,
  verified   boolean default false,
  created_at timestamptz default now(),
  unique (event_id, handle)
);

create table if not exists portfolio_items (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  image_url  text not null,
  position   int default 0,
  created_at timestamptz default now()
);

create table if not exists connections (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  from_profile uuid not null references profiles(id) on delete cascade,
  to_profile   uuid not null references profiles(id) on delete cascade,
  proposal     text,                 -- the explicit trade proposal
  status       text not null default 'pending',  -- pending | accepted | declined
  created_at   timestamptz default now(),
  unique (from_profile, to_profile)
);

create table if not exists collabs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  a_profile  uuid not null references profiles(id) on delete cascade,
  b_profile  uuid not null references profiles(id) on delete cascade,
  service    text,
  step       int not null default 1, -- 1 Requested · 2 Accepted · 3 In progress · 4 Completed
  a_done     boolean default false,  -- mutual sign-off on completion
  b_done     boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id             uuid primary key default gen_random_uuid(),
  collab_id      uuid not null references collabs(id) on delete cascade,
  sender_profile uuid not null references profiles(id) on delete cascade,
  body           text not null,
  created_at     timestamptz default now()
);

create table if not exists posts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  collab_id  uuid references collabs(id) on delete set null,
  a_profile  uuid references profiles(id) on delete set null,
  b_profile  uuid references profiles(id) on delete set null,
  title      text,
  image_url  text,
  tag        text,
  likes      int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_profiles_event on profiles(event_id);
create index if not exists idx_conn_event on connections(event_id);
create index if not exists idx_msg_collab on messages(collab_id);
create index if not exists idx_posts_event on posts(event_id);

-- ---------- realtime (live chat + live collab status) ----------
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table collabs;
alter publication supabase_realtime add table connections;

-- ---------- RLS: permissive for the handle-only demo ----------
do $$
declare t text;
begin
  foreach t in array array['events','profiles','portfolio_items','connections','collabs','messages','posts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- seed: one event + a starter roster so it is not empty ----------
insert into events (slug, name, subtitle)
values ('design-week-sf', 'Design Week SF', 'June 2026 · 214 attendees')
on conflict (slug) do nothing;

with e as (select id from events where slug = 'design-week-sf')
insert into profiles (event_id, handle, name, category, service, blurb, wants, avatar_url, verified)
select e.id, v.handle, v.name, v.category, v.service, v.blurb, v.wants, v.avatar_url, v.verified
from e, (values
  ('maya',  'Maya Rodriguez', 'Design',      'Visual identity',  'Logo systems and brand kits for early-stage products.', 'A bold consumer brand identity',   'https://randomuser.me/api/portraits/women/79.jpg', true),
  ('nina',  'Nina Alvarez',   'Design',      'Illustration',     'Editorial illustration and playful brand mascots.',     'Packaging illustration for her book','https://randomuser.me/api/portraits/women/63.jpg', false),
  ('leo',   'Leo Martins',    'Photography', 'Event & product',  'On-site event coverage and clean product shots.',       'Music and nightlife event work',   'https://randomuser.me/api/portraits/men/44.jpg',   true),
  ('theo',  'Theo Kim',       'Photography', 'Portraits',        'Natural-light portraits and founder headshots.',        'A creative founder portrait series','https://randomuser.me/api/portraits/men/4.jpg',   false),
  ('priya', 'Priya Shah',     'Writing',     'Naming & copy',    'Punchy product copy, taglines, and naming sprints.',    'Naming work for a launched startup','https://randomuser.me/api/portraits/women/88.jpg', false),
  ('sana',  'Sana Malik',     'Writing',     'Content strategy', 'Narrative and content systems for launches.',           'A long-form brand narrative piece','https://randomuser.me/api/portraits/women/48.jpg', true),
  ('devin', 'Devin Okafor',   'Development', 'Landing pages',    'Ships fast React marketing sites, animation-heavy.',    'An animation-heavy product site',  'https://randomuser.me/api/portraits/men/59.jpg',   true),
  ('ivy',   'Ivy Chen',       'Design',      'Motion graphics',  'Motion and launch teasers for product drops.',          'A punchy 20s launch teaser',       'https://randomuser.me/api/portraits/women/60.jpg', false)
) as v(handle, name, category, service, blurb, wants, avatar_url, verified)
on conflict (event_id, handle) do nothing;

-- one seeded feed post so the Feed tab has content on first load
with e as (select id from events where slug = 'design-week-sf'),
     a as (select id from profiles where handle = 'maya'),
     b as (select id from profiles where handle = 'leo')
insert into posts (event_id, a_profile, b_profile, title, image_url, tag, likes)
select e.id, a.id, b.id,
       'Coffee brand identity, shot on launch day',
       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop&q=80',
       'Design × Photography', 48
from e, a, b;
