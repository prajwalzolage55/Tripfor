import { getDistance } from './itinerary-engine';
import type { ItineraryItem } from './types';

export function recalculateDaySequence(items: ItineraryItem[]): ItineraryItem[] {
  if (items.length === 0) return [];

  const updated: ItineraryItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const cur = { ...items[i] };
    const prev = i > 0 ? updated[i - 1] : null;

    let distanceKm = 0;
    let travelMins = 0;
    const conflicts: string[] = [];

    // Calculate distance from previous location
    if (
      prev &&
      prev.location &&
      typeof prev.location.latitude === 'number' &&
      typeof prev.location.longitude === 'number' &&
      cur.location &&
      typeof cur.location.latitude === 'number' &&
      typeof cur.location.longitude === 'number'
    ) {
      distanceKm = Math.round(
        getDistance(
          prev.location.latitude,
          prev.location.longitude,
          cur.location.latitude,
          cur.location.longitude
        ) * 10
      ) / 10;

      // Realistic city transit estimate: ~2.5 mins per km + 5 mins parking/buffer
      travelMins = Math.max(10, Math.round(distanceKm * 2.5 + 5));

      cur.travel_distance_km = distanceKm;
      cur.estimated_travel_time = `${travelMins} mins`;
      cur.previous_location_id = prev.location_id || null;

      // Check transit buffer conflict: if prev end time and cur start time exist
      if (prev.end_time && cur.start_time) {
        const prevEnd = new Date(prev.end_time).getTime();
        const curStart = new Date(cur.start_time).getTime();
        const gapMins = (curStart - prevEnd) / (1000 * 60);

        if (gapMins < travelMins) {
          conflicts.push(
            `Tight connection: Need ~${travelMins} mins travel from "${prev.label}", but gap is only ${Math.round(gapMins)} mins.`
          );
        }
      }
    } else {
      cur.travel_distance_km = null;
      cur.estimated_travel_time = null;
      cur.previous_location_id = null;
    }

    // Check opening hours conflict if location has opening_hours
    if (cur.location?.opening_hours && cur.start_time) {
      try {
        const curDate = new Date(cur.start_time);
        const curH = curDate.getHours();
        const curM = curDate.getMinutes();
        const curMinutes = curH * 60 + curM;

        const [openH, openM] = cur.location.opening_hours.open.split(':').map(Number);
        const [closeH, closeM] = cur.location.opening_hours.close.split(':').map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        if (curMinutes < openMinutes) {
          conflicts.push(`Scheduled start (${cur.location.opening_hours.open}) is before opening time.`);
        } else if (curMinutes > closeMinutes) {
          conflicts.push(`Scheduled start is after closing time (${cur.location.opening_hours.close}).`);
        }
      } catch {
        // pass
      }
    }

    cur.conflicts = conflicts.length > 0 ? conflicts : null;
    updated.push(cur);
  }

  return updated;
}

export const ALTERNATIVE_LOCATIONS = [
  {
    id: 'alt-1',
    name: 'Old Town Heritage Quarter',
    category: 'attraction' as const,
    description: 'Charming cobblestone alleyways lined with colonial architecture and art galleries.',
    latitude: 15.53,
    longitude: 73.82,
    address: 'Old Town Square',
    opening_hours: { open: '08:00', close: '20:00' },
    recommended_duration: '90 minutes',
    entry_fee: 0,
    estimated_spending: 5,
    rating: 4.8,
    best_time_to_visit: 'Morning or late afternoon',
    created_at: new Date().toISOString(),
  },
  {
    id: 'alt-2',
    name: 'Cliffside Ocean Viewpoint',
    category: 'attraction' as const,
    description: 'Panoramic coastal views with sunset vistas and photography platforms.',
    latitude: 15.58,
    longitude: 73.72,
    address: 'North Coast Headland',
    opening_hours: { open: '06:00', close: '21:00' },
    recommended_duration: '60 minutes',
    entry_fee: 0,
    estimated_spending: 0,
    rating: 4.9,
    best_time_to_visit: 'Sunset (17:30 - 18:45)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'alt-3',
    name: 'Botanical Sanctuary & Gardens',
    category: 'attraction' as const,
    description: 'Lush tropical flora, orchid houses, and shaded canopy walking trails.',
    latitude: 15.48,
    longitude: 73.88,
    address: 'Valley Reserve Road',
    opening_hours: { open: '09:00', close: '17:30' },
    recommended_duration: '120 minutes',
    entry_fee: 8,
    estimated_spending: 5,
    rating: 4.7,
    best_time_to_visit: 'Morning',
    created_at: new Date().toISOString(),
  },
  {
    id: 'alt-4',
    name: 'Seaside Grill & Catch of the Day',
    category: 'restaurant' as const,
    description: 'Fresh grilled seafood, woodfired delicacies, and beachside outdoor dining.',
    latitude: 15.51,
    longitude: 73.76,
    address: 'Marina Bay Promenade',
    opening_hours: { open: '12:00', close: '23:00' },
    recommended_duration: '90 minutes',
    entry_fee: 0,
    estimated_spending: 35,
    rating: 4.8,
    best_time_to_visit: 'Lunch or Dinner',
    created_at: new Date().toISOString(),
  },
  {
    id: 'alt-5',
    name: 'Coastal Kayaking & Sea Caves',
    category: 'activity' as const,
    description: 'Guided kayak tour through turquoise waters, hidden coves, and sea caves.',
    latitude: 15.45,
    longitude: 73.79,
    address: 'South Harbor Pier',
    opening_hours: { open: '08:00', close: '17:00' },
    recommended_duration: '150 minutes',
    entry_fee: 25,
    estimated_spending: 10,
    rating: 4.9,
    best_time_to_visit: 'Morning (calm waters)',
    created_at: new Date().toISOString(),
  },
];
