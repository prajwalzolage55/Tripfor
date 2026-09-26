-- ─────────────────────────────────────────────────────────────────
-- GroupTrip Ledger — User Profiles Migration
-- Adds a user_profiles table for storing display name, phone/UPI,
-- and avatar URL. Safe & idempotent.
-- ─────────────────────────────────────────────────────────────────

-- 1. Create user_profiles table
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Traveler',
  phone text default '',
  email text default '',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table user_profiles enable row level security;

-- 3. Policies: users can read all profiles (for trip member display)
--    but can only update their own
drop policy if exists "anyone can read profiles" on user_profiles;
create policy "anyone can read profiles" on user_profiles for select
  using (true);

drop policy if exists "users can insert own profile" on user_profiles;
create policy "users can insert own profile" on user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on user_profiles;
create policy "users can update own profile" on user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. Index on phone for UPI lookups
create index if not exists idx_user_profiles_phone on user_profiles(phone);
