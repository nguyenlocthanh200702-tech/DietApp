-- Run this in Supabase Dashboard → SQL Editor (once per project)
--
-- Auth uses username + password in the app. Supabase stores accounts as
-- username@forge.auth internally (users never see or enter an email).
-- In Supabase Dashboard → Authentication → Providers → Email:
--   turn OFF "Confirm email" so sign-up works without email verification.

-- Profile (one row per user, linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
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
  created_at timestamptz not null default now()
);

-- Logged meals
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  description text not null,
  meal_name text not null default 'Meal',
  calories integer not null default 0,
  protein integer not null default 0,
  carbs integer not null default 0,
  fat integer not null default 0
);

create index if not exists meals_user_id_logged_at_idx on public.meals (user_id, logged_at desc);

-- Daily water intake
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  amount_ml integer not null default 0,
  unique (user_id, log_date)
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.water_logs enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

create policy "Users read own meals"
  on public.meals for select
  using (auth.uid() = user_id);

create policy "Users insert own meals"
  on public.meals for insert
  with check (auth.uid() = user_id);

create policy "Users update own meals"
  on public.meals for update
  using (auth.uid() = user_id);

create policy "Users delete own meals"
  on public.meals for delete
  using (auth.uid() = user_id);

create policy "Users read own water logs"
  on public.water_logs for select
  using (auth.uid() = user_id);

create policy "Users insert own water logs"
  on public.water_logs for insert
  with check (auth.uid() = user_id);

create policy "Users update own water logs"
  on public.water_logs for update
  using (auth.uid() = user_id);

create policy "Users delete own water logs"
  on public.water_logs for delete
  using (auth.uid() = user_id);
