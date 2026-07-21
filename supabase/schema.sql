-- Project One — Connect & Collab · v2 schema (check-in model)
-- Run this in the Supabase SQL editor (SQL → New query → paste → Run).
-- Handle-only identity for the demo: there is no Supabase Auth here, so RLS
-- is intentionally permissive (anon can read/write). NOT production-secure —
-- round two adds real auth + tight policies.

-- ---------- tables ----------

create table if not exists profiles (
  id         uuid primary key default gen_random_uuid(),
  handle     text unique not null,
  name       text not null,
  category   text not null,          -- Design | Photography | Writing | Development
  service    text not null,          -- e.g. "Visual identity"
  blurb      text,
  wants      text,                   -- the Classifieds "wants to build" line
  avatar_url text,
  verified   boolean default false,
  created_at timestamptz default now()
);

create table if not exists check_ins (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  location      text not null,       -- freeform, normalized lowercase + trimmed on insert
  checked_in_at timestamptz not null default now()
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
  from_profile uuid not null references profiles(id) on delete cascade,
  to_profile   uuid not null references profiles(id) on delete cascade,
  proposal     text,                 -- the explicit trade proposal
  status       text not null default 'pending',  -- pending | accepted | declined
  created_at   timestamptz default now(),
  unique (from_profile, to_profile)
);

create table if not exists collabs (
  id         uuid primary key default gen_random_uuid(),
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
  collab_id  uuid references collabs(id) on delete set null,
  a_profile  uuid references profiles(id) on delete set null,
  b_profile  uuid references profiles(id) on delete set null,
  title      text,
  image_url  text,
  tag        text,
  location   text,                   -- where the collaborators originally checked in together
  likes      int default 0,
  created_at timestamptz default now()
);

-- ---------- indexes ----------

create index if not exists idx_checkins_location_time on check_ins(location, checked_in_at desc);
create index if not exists idx_checkins_profile on check_ins(profile_id, checked_in_at desc);
create index if not exists idx_msg_collab on messages(collab_id);
create index if not exists idx_posts_created on posts(created_at desc);

-- ---------- realtime ----------
do $$
declare t text;
begin
  foreach t in array array['messages','collabs','connections','check_ins']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ---------- RLS: permissive for the handle-only demo ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','portfolio_items','connections','collabs','messages','posts','check_ins']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- seed: starter roster + check-ins so it is not empty ----------

insert into profiles (handle, name, category, service, blurb, wants, avatar_url, verified)
values
  ('maya',  'Maya Rodriguez', 'Design',      'Visual identity',  'Logo systems and brand kits for early-stage products.', 'A bold consumer brand identity',   'https://randomuser.me/api/portraits/women/79.jpg', true),
  ('nina',  'Nina Alvarez',   'Design',      'Illustration',     'Editorial illustration and playful brand mascots.',     'Packaging illustration for her book','https://randomuser.me/api/portraits/women/63.jpg', false),
  ('leo',   'Leo Martins',    'Photography', 'Event & product',  'On-site event coverage and clean product shots.',       'Music and nightlife event work',   'https://randomuser.me/api/portraits/men/44.jpg',   true),
  ('theo',  'Theo Kim',       'Photography', 'Portraits',        'Natural-light portraits and founder headshots.',        'A creative founder portrait series','https://randomuser.me/api/portraits/men/4.jpg',   false),
  ('priya', 'Priya Shah',     'Writing',     'Naming & copy',    'Punchy product copy, taglines, and naming sprints.',    'Naming work for a launched startup','https://randomuser.me/api/portraits/women/88.jpg', false),
  ('sana',  'Sana Malik',     'Writing',     'Content strategy', 'Narrative and content systems for launches.',           'A long-form brand narrative piece','https://randomuser.me/api/portraits/women/48.jpg', true),
  ('devin', 'Devin Okafor',   'Development', 'Landing pages',    'Ships fast React marketing sites, animation-heavy.',    'An animation-heavy product site',  'https://randomuser.me/api/portraits/men/59.jpg',   true),
  ('ivy',   'Ivy Chen',       'Design',      'Motion graphics',  'Motion and launch teasers for product drops.',          'A punchy 20s launch teaser',       'https://randomuser.me/api/portraits/women/60.jpg', false)
on conflict (handle) do nothing;

insert into check_ins (profile_id, location)
select id, 'the mill on divisadero'
from profiles
where handle in ('maya','nina','leo','theo','priya','sana','devin','ivy');

with a as (select id from profiles where handle = 'maya'),
     b as (select id from profiles where handle = 'leo')
insert into posts (a_profile, b_profile, title, image_url, tag, location, likes)
select a.id, b.id,
       'Coffee brand identity, shot on launch day',
       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop&q=80',
       'Design × Photography', 'the mill on divisadero', 48
from a, b;
