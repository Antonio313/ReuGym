-- ReuGym — full schema bootstrap for a fresh Supabase project.
--
-- This is the ".env.example" of the database: a generic, from-scratch
-- snapshot of the current schema (tables, RLS policies, storage bucket,
-- auth trigger) with no personal data or account-specific seeding baked in.
-- The actual numbered migrations this project runs against its live
-- database (supabase/migrations/001..014) aren't tracked in git — they're
-- this project's private history. If you're forking ReuGym for your own
-- Supabase project, run this file once against a fresh project instead of
-- trying to replay that history.
--
-- How to use:
--   1. Create a new Supabase project.
--   2. Paste this whole file into the SQL editor and run it.
--   3. Copy .env.example to .env.local and fill in your project's URL/keys.
--   4. Sign up for an account through the app once — the trigger at the
--      bottom creates your public.users row automatically.
--   5. (Optional) Run scripts/seed-default-exercises.mjs with your service
--      role key to populate the shared exercise library.
--   6. (Optional) Make your account an admin — see the commented block at
--      the very end of this file.

-- ─── Tables ─────────────────────────────────────────────────────

-- id references auth.users directly (not just "happens to equal" it) so
-- deleting a user from Auth cascades to their profile row instead of
-- leaving an orphan behind — an orphaned row here blocks any future signup
-- with the same email, since it collides with the UNIQUE constraint below
-- when the on_auth_user_created trigger (bottom of this file) tries to
-- insert the new one. See migrations/014_users_fk_auth.sql for the
-- incident this fixed.
create table users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text unique not null,
  created_at            timestamptz default now(),
  must_change_password  boolean not null default false,
  weight_unit           text not null default 'kg' check (weight_unit in ('kg', 'lbs')),
  has_seen_onboarding   boolean not null default false,
  has_completed_setup   boolean not null default false
);

create table workout_sessions (
  id               text primary key,
  user_id          uuid not null references users(id),
  template_id      text not null,
  started_at       bigint not null,
  completed_at     bigint,
  duration_seconds int,
  notes            text
);
create index on workout_sessions (user_id, started_at desc);

create table logged_sets (
  id           text primary key,
  user_id      uuid not null references users(id),
  session_id   text not null,
  exercise_id  text not null,
  set_number   int not null,
  weight_kg    float not null,
  reps         int not null,
  rir          int not null default 2,
  is_warmup    bool not null default false,
  is_pr        bool not null default false,
  completed_at bigint not null,
  side         text check (side in ('left', 'right'))
);
create index on logged_sets (user_id, exercise_id, completed_at desc);
create index on logged_sets (session_id);

create table exercise_prefs (
  user_id            uuid not null references users(id),
  exercise_id        text not null,
  starting_weight_kg float not null,
  starting_reps      int,
  primary key (user_id, exercise_id)
);

create table custom_exercises (
  id                 text not null,
  user_id            uuid not null references users(id),
  name               text not null,
  category           text not null,
  type               text not null,
  muscles            text[] not null default '{}',
  default_rep_range  int[],
  starting_weight_kg float not null default 0,
  rest_seconds       int not null default 60,
  is_bodyweight      bool not null default false,
  is_cable           bool not null default false,
  is_timed           bool not null default false,
  is_stretch         bool not null default false,
  video_url          text,
  notes              text,
  primary key (id, user_id)
);
create index on custom_exercises (user_id, is_stretch);

create table template_exercises (
  id                 text primary key,
  user_id            uuid not null references users(id),
  template_id        text not null,
  exercise_id        text not null,
  position           int not null,
  sets               int not null default 3,
  rep_range_min      int not null,
  rep_range_max      int not null,
  is_superset        bool not null default false,
  superset_group_id  text,
  starting_weight_kg float not null default 0,
  rest_seconds       int not null default 60,
  is_bodyweight      bool not null default false,
  is_timed           bool not null default false,
  substitutes        jsonb not null default '[]'::jsonb,
  is_per_side        bool not null default false
);
create index on template_exercises (user_id, template_id, position);

create table template_stretches (
  id                 text primary key,
  user_id            uuid not null references users(id),
  template_id        text not null,
  exercise_id        text not null,
  phase              text not null check (phase in ('pre','post')),
  position           int not null,
  rest_seconds       int not null default 15,
  sets               int not null default 1,
  rep_range_min      int not null default 1,
  rep_range_max      int not null default 1,
  starting_weight_kg float not null default 0,
  is_bodyweight      bool not null default false,
  is_timed           bool not null default false,
  is_per_side        bool not null default false
);
create index on template_stretches (user_id, template_id, phase, position);

create table body_stats (
  id          text primary key,
  user_id     uuid not null references users(id),
  date        bigint not null,
  weight_kg   float,
  waist_cm    float,
  chest_cm    float,
  notes       text,
  photo_paths text[] not null default '{}'
);
create index on body_stats (user_id, date desc);

create table loadout_names (
  user_id     uuid not null references users(id),
  template_id text not null,
  name        text not null,
  primary key (user_id, template_id)
);

create table active_loadouts (
  user_id     uuid not null references users(id),
  category    text not null,
  template_id text not null,
  primary key (user_id, category)
);

-- Shared exercise library — one row set for everyone (no user_id). A
-- per-user custom_exercises row with a matching id overrides it client-side.
-- Populate via scripts/seed-default-exercises.mjs after this schema is applied.
create table default_exercises (
  id                text primary key,
  name              text not null,
  category          text not null,
  type              text not null,
  muscles           text[] not null default '{}',
  default_rep_range int[],
  rest_seconds      int,
  is_bodyweight     bool not null default false,
  is_cable          bool not null default false,
  is_timed          bool not null default false,
  is_stretch        bool not null default false,
  video_url         text
);

-- ─── Storage: progress photos ─────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- ─── Row Level Security ────────────────────────────────────────────
-- Every table is user_id-scoped and every real query in this app already
-- filters by the signed-in user's own id, so these policies just make that
-- boundary real at the database layer instead of only in client code.

alter table users               enable row level security;
alter table workout_sessions    enable row level security;
alter table logged_sets         enable row level security;
alter table exercise_prefs      enable row level security;
alter table custom_exercises    enable row level security;
alter table template_exercises  enable row level security;
alter table template_stretches  enable row level security;
alter table body_stats          enable row level security;
alter table loadout_names       enable row level security;
alter table active_loadouts     enable row level security;
alter table default_exercises   enable row level security;

create policy "own row" on users
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "own rows" on workout_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on logged_sets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on exercise_prefs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on custom_exercises
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on template_exercises
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on template_stretches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on body_stats
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on loadout_names
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on active_loadouts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "any authenticated user can read" on default_exercises
  for select to authenticated
  using (true);

create policy "admin can insert" on default_exercises
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

create policy "admin can update" on default_exercises
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

create policy "own progress photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Auth trigger: create the profile row on signup ────────────────
-- Runs server-side as a security-definer function, so it bypasses RLS by
-- design instead of needing to satisfy it — required because this app
-- requires email confirmation, so no session exists yet at the moment a
-- brand-new account's first row would otherwise need to be inserted.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Optional: make your account an admin ──────────────────────────
-- Admins get a "sync my library to defaults" action in Settings, which
-- upserts into default_exercises for every user to pick up. Sign up
-- through the app first, then run this once with your own email:
--
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('is_admin', true)
-- where email = 'you@example.com';
