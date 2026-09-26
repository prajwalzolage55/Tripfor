-- ─────────────────────────────────────────────────────────────────
-- GroupTrip Ledger — Phase 1 Itinerary Planner Migration
-- Safe & idempotent script: can be run on an existing database
-- ─────────────────────────────────────────────────────────────────

-- 1. Create Trip Preferences table
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

-- 2. Create Locations Library (Destinations, Attractions, Hotels, Restaurants)
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

-- 3. Create Itinerary Days table
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

-- 4. Safely add new columns to itinerary_items
alter table itinerary_items
  add column if not exists itinerary_day_id uuid references itinerary_days(id) on delete cascade,
  add column if not exists location_id uuid references locations(id),
  add column if not exists estimated_travel_time interval,
  add column if not exists travel_distance_km numeric(10,2),
  add column if not exists previous_location_id uuid references locations(id),
  add column if not exists short_description text,
  add column if not exists conflicts jsonb;

-- 5. Enable RLS
alter table trip_preferences enable row level security;
alter table locations enable row level security;
alter table itinerary_days enable row level security;

-- 6. RLS Policies (drop if exists first to avoid duplicate policy errors)
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

drop policy if exists "anyone can read locations" on locations;
create policy "anyone can read locations" on locations for select
  using (true);

drop policy if exists "authenticated users can insert locations" on locations;
create policy "authenticated users can insert locations" on locations for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated users can update locations" on locations;
create policy "authenticated users can update locations" on locations for update
  using (auth.role() = 'authenticated');

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
