// Database types matching the Supabase schema

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

export type ItemType = 'flight' | 'hotel' | 'activity' | 'transfer' | 'dining' | 'other';
export type SplitType = 'equal' | 'flat_per_person' | 'per_night' | 'percentage' | 'organizer_paid';
export type ItemStatus = 'active' | 'cancelled';

export interface TripPreferences {
  id: string;
  trip_id: string;
  total_budget: number | null;
  travel_style: 'Budget' | 'Relaxed' | 'Balanced' | 'Packed' | 'Luxury' | string | null;
  interests: string[] | null;
  transport_preferences: string[] | null;
  food_preferences: string[] | null;
  accommodation_preference: string | null;
  special_requirements: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  category: 'attraction' | 'restaurant' | 'hotel' | 'transit' | 'shopping' | 'activity' | 'other';
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  opening_hours: { open: string; close: string } | null;
  recommended_duration: string | null;
  entry_fee: number;
  estimated_spending: number;
  rating: number | null;
  best_time_to_visit: string | null;
  created_at: string;
}

export interface ItineraryDayRecord {
  id: string;
  trip_id: string;
  day_date: string;
  day_index: number;
  title: string | null;
  weather_forecast: Record<string, any> | null;
  created_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  itinerary_day_id?: string | null;
  location_id?: string | null;
  type: ItemType;
  label: string;
  start_time: string | null;
  end_time: string | null;
  cost: number;
  default_split_type: SplitType;
  status: ItemStatus;
  estimated_travel_time?: string | null;
  travel_distance_km?: number | null;
  previous_location_id?: string | null;
  short_description?: string | null;
  conflicts?: any[] | null;
  created_at: string;
  location?: LocationRecord | null;
}

export interface ItemParticipant {
  item_id: string;
  member_id: string;
  percentage: number | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Expense {
  id: string;
  trip_id: string;
  item_id: string | null;
  amount: number;
  paid_by: string;
  split_type: SplitType;
  receipt_url: string | null;
  note: string | null;
  created_at: string;
}

export interface SettlementRow {
  id: string;
  trip_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  status: 'pending' | 'paid';
  upi_link: string | null;
  generated_at: string;
}
