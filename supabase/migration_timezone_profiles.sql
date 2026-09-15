-- Run in Supabase SQL Editor after the main schema (one time)

-- Per-timezone fitness profiles (two per account: local + brantford)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  timezone_key text not null,
  name text not null,
  weight numeric not null,
  height numeric not null,
  age integer not null,
  goal text not null,
  activity_level text not null,
  dietary_restrictions text,
  macro_calories integer not null,
  macro_protein integer not null,
  macro_carbs integer not null,
  macro_fat integer not null,
  water_goal integer not null default 2000,
  bottle_size integer not null default 2000,
  created_at timestamptz not null default now(),
  unique (user_id, timezone_key)
);

alter table public.meals add column if not exists timezone_key text not null default 'local';

alter table public.water_logs add column if not exists timezone_key text not null default 'local';

alter table public.water_logs drop constraint if exists water_logs_user_id_log_date_key;

create unique index if not exists water_logs_user_tz_date_idx
  on public.water_logs (user_id, timezone_key, log_date);

alter table public.user_profiles enable row level security;

create policy "Users read own user_profiles"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own user_profiles"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update own user_profiles"
  on public.user_profiles for update
  using (auth.uid() = user_id);

create policy "Users delete own user_profiles"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- Copy legacy single profile into "local" slot if present
insert into public.user_profiles (
  user_id, timezone_key, name, weight, height, age, goal, activity_level,
  dietary_restrictions, macro_calories, macro_protein, macro_carbs, macro_fat,
  water_goal, bottle_size, created_at
)
select
  id, 'local', name, weight, height, age, goal, activity_level,
  dietary_restrictions, macro_calories, macro_protein, macro_carbs, macro_fat,
  water_goal, bottle_size, created_at
from public.profiles
on conflict (user_id, timezone_key) do nothing;
