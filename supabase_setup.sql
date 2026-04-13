-- Run this in Supabase SQL Editor
-- Creates tables for online territory sync + run history

-- 0. CLEAN UP EXISTING (Fixes the "policy already exists" error)
drop table if exists runs cascade;
drop table if exists territories cascade;
drop table if exists profiles cascade;

-- 1. PROFILES — for usernames
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone" on profiles
  for select using (true);

create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- 2. TERRITORIES — each hex owned by one player (last runner wins)
create table if not exists territories (
  hex_id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  captured_at timestamp with time zone default now()
);

alter table territories enable row level security;

-- Anyone can see all territory (needed for the map)
create policy "Anyone can view territories" on territories
  for select using (true);

-- Users can claim unclaimed hexes
create policy "Users can insert territories" on territories
  for insert with check (auth.uid() = user_id);

-- Users can steal hexes (update ownership)
create policy "Users can update territories" on territories
  for update using (true)
  with check (auth.uid() = user_id);

-- 3. RUNS — run history per user
create table if not exists runs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  hexes_captured integer default 0,
  donut_hexes integer default 0,
  distance_km real default 0,
  duration integer default 0,
  xp_earned integer default 0,
  started_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table runs enable row level security;

-- Users can only see their own runs
create policy "Users can view own runs" on runs
  for select using (auth.uid() = user_id);

-- Users can insert their own runs
create policy "Users can insert runs" on runs
  for insert with check (auth.uid() = user_id);

-- 4. Create indexes for fast queries
create index if not exists idx_territories_user on territories(user_id);
create index if not exists idx_runs_user on runs(user_id);
create index if not exists idx_runs_created on runs(created_at desc);
