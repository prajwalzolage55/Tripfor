export interface Location {
  id: string;
  name: string;
  category: 'attraction' | 'restaurant' | 'hotel' | 'transit' | 'shopping' | 'activity' | 'other';
  latitude: number;
  longitude: number;
  recommendedDurationMinutes: number;
  entryFee: number;
  estimatedSpending: number;
  openingHours?: { open: string; close: string }; // "09:00", "17:00"
}

export interface TripPreferences {
  totalBudget: number | null;
  travelStyle: string; // 'Budget' | 'Relaxed' | 'Balanced' | 'Packed' | 'Luxury'
  startDate: string;
  endDate: string;
  travelers: number;
  accommodationPreference: string;
}

export interface ItineraryItem {
  id: string;
  locationId?: string;
  location?: Location;
  title: string;
  startTime: string; // ISO string or simple "HH:mm" for the day
  endTime: string;
  travelDistanceKm: number;
  estimatedTravelTimeMinutes: number;
  cost: number;
  category: string;
  conflicts: any[];
}

export interface ItineraryDay {
  dayIndex: number;
  date: string;
  title: string;
  items: ItineraryItem[];
}

// Haversine formula for distance in km
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Convert "HH:mm" to minutes since midnight
function timeToMins(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Convert minutes since midnight to "HH:mm"
function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Main Deterministic Engine
export function buildDeterministicItinerary(
  preferences: TripPreferences,
  locations: Location[]
): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  
  if (!preferences.startDate || !preferences.endDate) return days;
  const start = new Date(preferences.startDate);
  const end = new Date(preferences.endDate);
  const numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);

  // Constants based on style
  const style = preferences.travelStyle || 'Balanced';
  let maxActivitiesPerDay = 3;
  if (style === 'Relaxed' || style === 'Luxury') maxActivitiesPerDay = 2;
  if (style === 'Packed') maxActivitiesPerDay = 5;

  let locationPool = [...locations];
  
  for (let i = 0; i < numDays; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + i);
    
    const items: ItineraryItem[] = [];
    let currentMins = timeToMins("09:00"); // Start day at 9 AM
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    // Breakfast
    items.push({
      id: `breakfast-${i}`,
      title: "Breakfast",
      startTime: minsToTime(currentMins),
      endTime: minsToTime(currentMins + 45),
      travelDistanceKm: 0,
      estimatedTravelTimeMinutes: 0,
      cost: style === 'Budget' ? 10 : 25,
      category: 'dining',
      conflicts: []
    });
    currentMins += 45;

    // Select Activities
    let activitiesToday = 0;
    while (activitiesToday < maxActivitiesPerDay && locationPool.length > 0) {
      // Find nearest next location (Greedy approach)
      let nextLocIdx = 0;
      let minDistance = Number.MAX_VALUE;

      if (lastLat !== null && lastLng !== null) {
        for (let j = 0; j < locationPool.length; j++) {
          const dist = getDistance(lastLat, lastLng, locationPool[j].latitude, locationPool[j].longitude);
          if (dist < minDistance) {
            minDistance = dist;
            nextLocIdx = j;
          }
        }
      }

      const nextLoc = locationPool.splice(nextLocIdx, 1)[0];
      const travelDist = lastLat !== null ? minDistance : 0;
      const travelMins = Math.round(travelDist * 3); // Approx 3 mins per km in city
      
      if (travelMins > 0) {
        currentMins += travelMins;
      }

      // Check opening hours conflict
      let conflicts = [];
      if (nextLoc.openingHours) {
        const closeMins = timeToMins(nextLoc.openingHours.close);
        if (currentMins + nextLoc.recommendedDurationMinutes > closeMins) {
          conflicts.push({ type: 'hours', message: `Activity goes past closing time (${nextLoc.openingHours.close})` });
        }
      }

      items.push({
        id: nextLoc.id,
        locationId: nextLoc.id,
        location: nextLoc,
        title: nextLoc.name,
        startTime: minsToTime(currentMins),
        endTime: minsToTime(currentMins + nextLoc.recommendedDurationMinutes),
        travelDistanceKm: Math.round(travelDist * 10) / 10,
        estimatedTravelTimeMinutes: travelMins,
        cost: nextLoc.entryFee + nextLoc.estimatedSpending,
        category: nextLoc.category,
        conflicts
      });

      currentMins += nextLoc.recommendedDurationMinutes;
      lastLat = nextLoc.latitude;
      lastLng = nextLoc.longitude;
      activitiesToday++;

      // Inject Lunch around 12:30 - 13:30 if crossed
      if (currentMins >= timeToMins("12:30") && currentMins < timeToMins("14:00") && !items.find(i => i.title === 'Lunch')) {
        items.push({
          id: `lunch-${i}`,
          title: "Lunch",
          startTime: minsToTime(currentMins),
          endTime: minsToTime(currentMins + 60),
          travelDistanceKm: 0,
          estimatedTravelTimeMinutes: 10,
          cost: style === 'Budget' ? 15 : 40,
          category: 'dining',
          conflicts: []
        });
        currentMins += 60;
      }
    }

    // Dinner at end of day
    if (currentMins < timeToMins("19:00")) {
      currentMins = timeToMins("19:00");
    }
    items.push({
      id: `dinner-${i}`,
      title: "Dinner",
      startTime: minsToTime(currentMins),
      endTime: minsToTime(currentMins + 90),
      travelDistanceKm: 0,
      estimatedTravelTimeMinutes: 15,
      cost: style === 'Budget' ? 20 : 60,
      category: 'dining',
      conflicts: []
    });

    days.push({
      dayIndex: i + 1,
      date: dayDate.toISOString().split('T')[0],
      title: `Day ${i + 1}`,
      items
    });
  }

  return days;
}

// Detect Conflicts
export function detectConflicts(items: ItineraryItem[]): void {
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i+1];
    if (timeToMins(current.endTime) > timeToMins(next.startTime)) {
      next.conflicts.push({ type: 'overlap', message: 'Time overlap with previous activity.' });
    }
  }
}

// Compute dynamic budget
export function calculateBudget(days: ItineraryDay[], travelers: number) {
  let acc = 0, trans = 0, food = 0, act = 0, misc = 0;
  
  days.forEach(day => {
    day.items.forEach(item => {
      if (item.category === 'dining') food += item.cost * travelers;
      else if (item.category === 'attraction' || item.category === 'activity') act += item.cost * travelers;
      else if (item.category === 'transit') trans += item.cost * travelers;
      else misc += item.cost * travelers;
      
      if (item.estimatedTravelTimeMinutes > 0) trans += (item.estimatedTravelTimeMinutes * 0.5); // Approx transit cost
    });
    // Add per night hotel approx
    acc += 150; 
  });

  const total = acc + trans + food + act + misc;
  return { accommodation: acc, transportation: trans, food, activities: act, miscellaneous: misc, total };
}
