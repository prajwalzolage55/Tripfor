-- GroupTrip Ledger — Supabase Schema
-- Run this in your Supabase SQL editor (Safe & Idempotent)

create extension if not exists "pgcrypto";

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date,
  end_date date,
  invite_code text unique not null default substr(md5(random()::text),1,6),
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table if not exists trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references auth.users(id),
  display_name text not null,
  joined_at timestamptz default now(),
  unique(trip_id, user_id)
);

create table if not exists itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  type text check (type in ('flight','hotel','activity','transfer','dining','other')),
  label text not null,
  start_time timestamptz,
  end_time timestamptz,
  cost numeric(10,2) default 0,
  default_split_type text default 'equal'
    check (default_split_type in ('equal','flat_per_person','per_night','percentage','organizer_paid')),
  status text default 'active' check (status in ('active','cancelled')),
  created_at timestamptz default now()
);

-- THE ASSIGNMENT LAYER — who's part of which booking
create table if not exists item_participants (
  item_id uuid references itinerary_items(id) on delete cascade,
  member_id uuid references trip_members(id) on delete cascade,
  percentage numeric(5,2),      -- used only when split_type = 'percentage'
  start_date date,              -- used only when split_type = 'per_night'
  end_date date,                -- used only when split_type = 'per_night'
  primary key (item_id, member_id)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  item_id uuid references itinerary_items(id),
  amount numeric(10,2) not null,
  paid_by uuid references trip_members(id) not null,
  split_type text not null default 'equal'
    check (split_type in ('equal','flat_per_person','per_night','percentage','organizer_paid')),
  receipt_url text,
  note text,
  created_at timestamptz default now()
);

-- Generated output only — never hand-edited, always regenerated from current data
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  from_member uuid references trip_members(id),
  to_member uuid references trip_members(id),
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending','paid')),
  upi_link text,
  generated_at timestamptz default now()
);

-- RLS: enable on every table, restrict to members of that trip
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table itinerary_items enable row level security;
alter table item_participants enable row level security;
alter table expenses enable row level security;
alter table settlements enable row level security;

-- Safe membership check to avoid infinite recursion
create or replace function public.is_trip_member(t_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from trip_members
    where trip_id = t_id
    and user_id = auth.uid()
  );
$$;

-- Trips: creator can insert, members can read
drop policy if exists "creator can insert trips" on trips;
create policy "creator can insert trips" on trips for insert
  with check (created_by = auth.uid());

drop policy if exists "members can read their trip" on trips;
create policy "members can read their trip" on trips for select
  using (created_by = auth.uid() or public.is_trip_member(id));

drop policy if exists "creator can update trip" on trips;
create policy "creator can update trip" on trips for update
  using (created_by = auth.uid());

-- Trip Members: members can read
drop policy if exists "members can read trip_members" on trip_members;
create policy "members can read trip_members" on trip_members for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert trip_members" on trip_members;
create policy "members can insert trip_members" on trip_members for insert
  with check (user_id = auth.uid() or public.is_trip_member(trip_id));

-- Itinerary Items: members can CRUD
drop policy if exists "members can read itinerary" on itinerary_items;
create policy "members can read itinerary" on itinerary_items for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert itinerary" on itinerary_items;
create policy "members can insert itinerary" on itinerary_items for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "members can update itinerary" on itinerary_items;
create policy "members can update itinerary" on itinerary_items for update
  using (public.is_trip_member(trip_id));

drop policy if exists "members can delete itinerary" on itinerary_items;
create policy "members can delete itinerary" on itinerary_items for delete
  using (public.is_trip_member(trip_id));

-- Item Participants: members can CRUD
drop policy if exists "members can read item_participants" on item_participants;
create policy "members can read item_participants" on item_participants for select
  using (public.is_trip_member((select trip_id from itinerary_items where id = item_id)));

drop policy if exists "members can insert item_participants" on item_participants;
create policy "members can insert item_participants" on item_participants for insert
  with check (public.is_trip_member((select trip_id from itinerary_items where id = item_id)));

drop policy if exists "members can update item_participants" on item_participants;
create policy "members can update item_participants" on item_participants for update
  using (public.is_trip_member((select trip_id from itinerary_items where id = item_id)));

drop policy if exists "members can delete item_participants" on item_participants;
create policy "members can delete item_participants" on item_participants for delete
  using (public.is_trip_member((select trip_id from itinerary_items where id = item_id)));

-- Expenses: members can read, insert, delete
drop policy if exists "members can read expenses" on expenses;
create policy "members can read expenses" on expenses for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert expenses" on expenses;
create policy "members can insert expenses" on expenses for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "members can update expenses" on expenses;
create policy "members can update expenses" on expenses for update
  using (public.is_trip_member(trip_id));

drop policy if exists "members can delete expenses" on expenses;
create policy "members can delete expenses" on expenses for delete
  using (public.is_trip_member(trip_id));

-- Settlements: members can read, members can manage (auto-generated)
drop policy if exists "members can read settlements" on settlements;
create policy "members can read settlements" on settlements for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert settlements" on settlements;
create policy "members can insert settlements" on settlements for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "members can update settlements" on settlements;
create policy "members can update settlements" on settlements for update
  using (public.is_trip_member(trip_id));

drop policy if exists "members can delete settlements" on settlements;
create policy "members can delete settlements" on settlements for delete
  using (public.is_trip_member(trip_id));

-- Safe join-by-code flow — do this via RPC, not a raw client insert
create or replace function join_trip(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_trip_id uuid;
begin
  select id into v_trip_id from trips where invite_code = p_code;
  if v_trip_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into trip_members (trip_id, user_id, display_name)
  values (v_trip_id, auth.uid(), p_display_name)
  on conflict (trip_id, user_id) do update set display_name = excluded.display_name;
  return v_trip_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- PHASE 1: ITINERARY PLANNER SCHEMA EXPANSION
-- ─────────────────────────────────────────────────────────────────

-- Trip Preferences
create table if not exists trip_preferences (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade unique,
  total_budget numeric(10,2),
  travel_style text check (travel_style in ('Budget', 'Relaxed', 'Balanced', 'Packed', 'Luxury')),
  interests text[],
  transport_preferences text[],
  food_preferences text[],
  accommodation_preference text,
  special_requirements text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Locations Library (Destinations, Attractions, Hotels, Restaurants)
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('attraction', 'restaurant', 'hotel', 'transit', 'shopping', 'activity', 'other')),
  description text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  address text,
  opening_hours jsonb,
  recommended_duration interval,
  entry_fee numeric(10,2) default 0,
  estimated_spending numeric(10,2) default 0,
  rating numeric(3,2),
  best_time_to_visit text,
  created_at timestamptz default now()
);

-- Itinerary Days
create table if not exists itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  day_date date not null,
  day_index integer not null,
  title text,
  weather_forecast jsonb,
  created_at timestamptz default now(),
  unique(trip_id, day_date)
);

-- Expand existing itinerary_items table
alter table itinerary_items
  add column if not exists itinerary_day_id uuid references itinerary_days(id) on delete cascade,
  add column if not exists location_id uuid references locations(id),
  add column if not exists estimated_travel_time interval,
  add column if not exists travel_distance_km numeric(10,2),
  add column if not exists previous_location_id uuid references locations(id),
  add column if not exists short_description text,
  add column if not exists conflicts jsonb;

-- ─────────────────────────────────────────────────────────────────
-- RLS POLICIES FOR NEW TABLES
-- ─────────────────────────────────────────────────────────────────

alter table trip_preferences enable row level security;
alter table locations enable row level security;
alter table itinerary_days enable row level security;

-- Trip Preferences: members can read/write
drop policy if exists "members can read trip_preferences" on trip_preferences;
create policy "members can read trip_preferences" on trip_preferences for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert trip_preferences" on trip_preferences;
create policy "members can insert trip_preferences" on trip_preferences for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "members can update trip_preferences" on trip_preferences;
create policy "members can update trip_preferences" on trip_preferences for update
  using (public.is_trip_member(trip_id));

drop policy if exists "members can delete trip_preferences" on trip_preferences;
create policy "members can delete trip_preferences" on trip_preferences for delete
  using (public.is_trip_member(trip_id));

-- Locations: public read (it's a shared library of places), admin insert
drop policy if exists "anyone can read locations" on locations;
create policy "anyone can read locations" on locations for select
  using (true);

drop policy if exists "authenticated users can insert locations" on locations;
create policy "authenticated users can insert locations" on locations for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated users can update locations" on locations;
create policy "authenticated users can update locations" on locations for update
  using (auth.role() = 'authenticated');

-- Itinerary Days: members can CRUD
drop policy if exists "members can read itinerary_days" on itinerary_days;
create policy "members can read itinerary_days" on itinerary_days for select
  using (public.is_trip_member(trip_id));

drop policy if exists "members can insert itinerary_days" on itinerary_days;
create policy "members can insert itinerary_days" on itinerary_days for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "members can update itinerary_days" on itinerary_days;
create policy "members can update itinerary_days" on itinerary_days for update
  using (public.is_trip_member(trip_id));

drop policy if exists "members can delete itinerary_days" on itinerary_days;
create policy "members can delete itinerary_days" on itinerary_days for delete
  using (public.is_trip_member(trip_id));
