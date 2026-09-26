import { db } from './firebase';
import { collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { buildDeterministicItinerary, Location, TripPreferences } from './itinerary-engine';

const ALIBAG_LOCATIONS: Location[] = [
  { id: 'a1111111-1111-1111-1111-111111111111', name: 'Alibag Beach & Promenade', category: 'attraction', latitude: 18.6414, longitude: 72.8722, recommendedDurationMinutes: 120, entryFee: 0, estimatedSpending: 10, openingHours: { open: "06:00", close: "20:00" } },
  { id: 'a2222222-2222-2222-2222-222222222222', name: 'Kolaba Sea Fort', category: 'attraction', latitude: 18.6300, longitude: 72.8600, recommendedDurationMinutes: 120, entryFee: 5, estimatedSpending: 5, openingHours: { open: "09:00", close: "17:30" } },
  { id: 'a3333333-3333-3333-3333-333333333333', name: 'Varsoli White Sand Beach', category: 'attraction', latitude: 18.6600, longitude: 72.8700, recommendedDurationMinutes: 90, entryFee: 0, estimatedSpending: 5, openingHours: { open: "06:00", close: "21:00" } },
  { id: 'a4444444-4444-4444-4444-444444444444', name: 'Mandwa Beach & Water Sports', category: 'activity', latitude: 18.7900, longitude: 72.8800, recommendedDurationMinutes: 180, entryFee: 20, estimatedSpending: 25, openingHours: { open: "08:00", close: "18:00" } },
  { id: 'a5555555-5555-5555-5555-555555555555', name: 'Nagaon Water Sports Bay', category: 'activity', latitude: 18.5700, longitude: 72.9000, recommendedDurationMinutes: 150, entryFee: 15, estimatedSpending: 20, openingHours: { open: "08:30", close: "18:30" } },
  { id: 'a6666666-6666-6666-6666-666666666666', name: 'Kihim Beach & Coconut Groves', category: 'attraction', latitude: 18.7200, longitude: 72.8700, recommendedDurationMinutes: 90, entryFee: 0, estimatedSpending: 5, openingHours: { open: "07:00", close: "19:00" } },
  { id: 'a7777777-7777-7777-7777-777777777777', name: 'Murud-Janjira Sea Fortress', category: 'attraction', latitude: 18.3000, longitude: 72.9600, recommendedDurationMinutes: 180, entryFee: 10, estimatedSpending: 15, openingHours: { open: "09:00", close: "17:00" } },
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Golden Beach', category: 'attraction', latitude: 15.5, longitude: 73.8, recommendedDurationMinutes: 120, entryFee: 0, estimatedSpending: 5, openingHours: { open: "06:00", close: "20:00" } },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Historic Fort', category: 'attraction', latitude: 15.6, longitude: 73.7, recommendedDurationMinutes: 90, entryFee: 10, estimatedSpending: 5, openingHours: { open: "09:00", close: "17:00" } },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Spice Market', category: 'shopping', latitude: 15.55, longitude: 73.85, recommendedDurationMinutes: 60, entryFee: 0, estimatedSpending: 25, openingHours: { open: "10:00", close: "21:00" } },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Waterfall Hike', category: 'activity', latitude: 15.4, longitude: 74.1, recommendedDurationMinutes: 180, entryFee: 5, estimatedSpending: 10, openingHours: { open: "07:00", close: "16:00" } },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Cultural Museum', category: 'attraction', latitude: 15.52, longitude: 73.81, recommendedDurationMinutes: 120, entryFee: 15, estimatedSpending: 0, openingHours: { open: "10:00", close: "18:00" } },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Sunset Cruise', category: 'activity', latitude: 15.51, longitude: 73.75, recommendedDurationMinutes: 90, entryFee: 30, estimatedSpending: 15, openingHours: { open: "16:00", close: "19:00" } }
];

export async function generateTripItinerary(tripId: string) {
  // 1. Fetch Trip & Preferences
  const tripDoc = await getDoc(doc(db, 'trips', tripId));
  if (!tripDoc.exists()) throw new Error("Trip not found");
  const trip = tripDoc.data();

  const prefsQ = query(collection(db, 'trip_preferences'), where('trip_id', '==', tripId));
  const prefsDocs = await getDocs(prefsQ);
  const prefs = prefsDocs.empty ? null : prefsDocs.docs[0].data();

  const preferences: TripPreferences = {
    totalBudget: prefs?.total_budget || null,
    travelStyle: prefs?.travel_style || 'Balanced',
    startDate: trip.start_date || new Date().toISOString().split('T')[0],
    endDate: trip.end_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    travelers: 2,
    accommodationPreference: prefs?.accommodation_preference || 'Hotel'
  };

  // 2. Select Location pool based on Destination
  const destLower = (trip.destination || trip.name || '').toLowerCase();
  let locationPool: Location[] = [];

  if (destLower.includes('alibag') || destLower.includes('alibaug')) {
    locationPool = [...ALIBAG_LOCATIONS];
  } else {
    locationPool = [...DEFAULT_LOCATIONS];
  }

  // Save locations to DB to act as the cache
  for (const loc of locationPool) {
    await setDoc(doc(db, 'locations', loc.id), {
      id: loc.id,
      name: loc.name,
      category: loc.category,
      latitude: loc.latitude,
      longitude: loc.longitude,
      recommended_duration: `${loc.recommendedDurationMinutes} minutes`,
      entry_fee: loc.entryFee,
      estimated_spending: loc.estimatedSpending,
      opening_hours: loc.openingHours
    }, { merge: true });
  }

  // 3. Clear existing itinerary items and days for this trip so regeneration doesn't collide
  const oldItems = await getDocs(query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId)));
  for (const item of oldItems.docs) {
    await deleteDoc(item.ref);
  }
  
  const oldDays = await getDocs(query(collection(db, 'itinerary_days'), where('trip_id', '==', tripId)));
  for (const day of oldDays.docs) {
    await deleteDoc(day.ref);
  }

  // 4. Build Deterministic Itinerary
  const days = buildDeterministicItinerary(preferences, locationPool);

  // 5. Save to DB
  for (const day of days) {
    const dayRef = doc(collection(db, 'itinerary_days'));
    await setDoc(dayRef, {
      id: dayRef.id,
      trip_id: tripId,
      day_date: day.date,
      day_index: day.dayIndex,
      title: day.title
    });

    const itemsToInsert = day.items.map(item => {
      let type = 'activity';
      if (item.category === 'dining') type = 'dining';
      if (item.category === 'transit') type = 'transfer';
      if (item.category === 'hotel') type = 'hotel';

      const d = new Date(day.date + 'T00:00:00');
      const [h, m] = item.startTime.split(':').map(Number);
      const startTz = new Date(new Date(d).setHours(h, m, 0)).toISOString();
      const [eh, em] = item.endTime.split(':').map(Number);
      const endTz = new Date(new Date(d).setHours(eh, em, 0)).toISOString();

      const itemRef = doc(collection(db, 'itinerary_items'));
      return setDoc(itemRef, {
        id: itemRef.id,
        trip_id: tripId,
        itinerary_day_id: dayRef.id,
        location_id: item.locationId || null,
        type,
        label: item.title,
        start_time: startTz,
        end_time: endTz,
        cost: item.cost,
        default_split_type: 'equal',
        estimated_travel_time: `${item.estimatedTravelTimeMinutes} minutes`,
        travel_distance_km: item.travelDistanceKm,
        conflicts: item.conflicts
      });
    });

    if (itemsToInsert.length > 0) {
      await Promise.all(itemsToInsert);
    }
  }

  return true;
}

export const generateAndSaveItinerary = generateTripItinerary;
