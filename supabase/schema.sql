-- =============================================================
--  Trooth — Supabase / PostgreSQL schema (Phase 1: data layer)
--  Run this FIRST in the Supabase SQL editor, then run seed.sql.
--
--  Phase 1 goal: back the current app with a real database, with
--  NO visible change. Everything here is read-only for the public
--  (anonymous) role. Writes, auth, and resolution come in later phases.
-- =============================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- 1. categories -------------------------------------------------
--    The four fixed categories, with their accent colors. The app
--    currently hard-codes these; keeping them here lets the DB own
--    them later without a frontend change.
create table if not exists categories (
  name  text primary key,          -- 'Financial','Sports','Weather','Politics'
  color text not null,             -- accent hex
  tint  text not null              -- pill background hex
);

-- 2. forecasters -----------------------------------------------
create table if not exists forecasters (
  id             text primary key,          -- 'f1' (natural key for now)
  name           text not null,
  handle         text not null,
  org            text,
  category       text not null references categories(name),
  accuracy       integer not null,          -- career accuracy %  (was acc)
  resolved       integer not null default 0,
  pending        integer not null default 0,
  avg_confidence integer,                   -- stated confidence % (was conf)
  verified       boolean not null default false,
  avatar         text,                      -- avatar hex color
  initials       text,
  bio            text,
  spark          integer[] not null default '{}',  -- last-8 trend points
  created_at     timestamptz not null default now()
);
create index if not exists forecasters_category_idx on forecasters(category);

-- 3. forecaster_focus  (the "Accuracy by focus" breakdown) ------
create table if not exists forecaster_focus (
  id             uuid primary key default gen_random_uuid(),
  forecaster_id  text not null references forecasters(id) on delete cascade,
  label          text not null,
  pct            integer not null,
  sort_order     integer not null default 0
);
create index if not exists focus_forecaster_idx on forecaster_focus(forecaster_id);

-- 4. predictions ------------------------------------------------
--    NOTE: predicted_on / resolved_on are kept as display text for
--    now (e.g. 'Aug 4, 2025') so Phase 1 is a 1:1 mirror of the
--    current app. A later phase can migrate these to real `date`s.
create table if not exists predictions (
  id             text primary key,          -- 'p1'
  forecaster_id  text not null references forecasters(id) on delete cascade,
  claim          text not null,
  confidence     integer not null,          -- stated confidence %
  status         text not null default 'pending'
                   check (status in ('correct','incorrect','partial','pending')),
  predicted_on   text,                      -- was date
  resolved_on    text,                      -- was resolvedDate
  method         text check (method in ('auto','editorial','community')),
  outcome        text,
  source         text,
  agree_votes    integer not null default 0,
  dispute_votes  integer not null default 0,
  impact         numeric(4,1) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists predictions_forecaster_idx on predictions(forecaster_id);

-- =============================================================
--  ROW LEVEL SECURITY — public read-only (Phase 1)
--  Anonymous visitors may SELECT everything (it's a public
--  leaderboard). No INSERT/UPDATE/DELETE for anyone yet; those
--  arrive with auth in a later phase.
-- =============================================================
alter table categories       enable row level security;
alter table forecasters      enable row level security;
alter table forecaster_focus enable row level security;
alter table predictions      enable row level security;

create policy "public read categories"  on categories       for select using (true);
create policy "public read forecasters" on forecasters       for select using (true);
create policy "public read focus"       on forecaster_focus  for select using (true);
create policy "public read predictions" on predictions       for select using (true);
