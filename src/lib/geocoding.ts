/**
 * Geocoding and destination resolution utilities for GroupTripLedger
 * Supports offline coordinate dictionary for instant speed + Nominatim fallback.
 */

export const KNOWN_COORDINATES: Record<string, [number, number]> = {
  // Thailand
  thailand: [13.7563, 100.5018],
  bangkok: [13.7563, 100.5018],
  phuket: [7.8804, 98.3923],
  pattaya: [12.9276, 100.8771],
  chiangmai: [18.7883, 98.9853],
  krabi: [8.0863, 98.9063],
  samui: [9.5120, 100.0136],
  kohsamui: [9.5120, 100.0136],
  phiphi: [7.7407, 98.7784],
  huahin: [12.5684, 99.9577],

  // India
  goa: [15.2993, 74.1240],
  mumbai: [19.0760, 72.8777],
  delhi: [28.6139, 77.2090],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  alibag: [18.6414, 72.8722],
  alibaug: [18.6414, 72.8722],
  jaipur: [26.9124, 75.7873],
  udaipur: [24.5854, 73.7125],
  manali: [32.2432, 77.1892],
  kerala: [10.8505, 76.2711],
  kochi: [9.9312, 76.2673],
  ladakh: [34.1526, 77.5771],
  leh: [34.1526, 77.5771],
  shimla: [31.1048, 77.1734],
  agra: [27.1767, 78.0081],
  kolkata: [22.5726, 88.3639],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.3850, 78.4867],
  pune: [18.5204, 73.8567],

  // Asia / SE Asia
  bali: [-8.4095, 115.1889],
  indonesia: [-0.7893, 113.9213],
  singapore: [1.3521, 103.8198],
  malaysia: [3.1390, 101.6869],
  kualalumpur: [3.1390, 101.6869],
  dubai: [25.2048, 55.2708],
  uae: [23.4241, 53.8478],
  abudhabi: [24.4539, 54.3773],
  vietnam: [14.0583, 108.2772],
  hanoi: [21.0285, 105.8542],
  danang: [16.0544, 108.2022],
  hochiminh: [10.8231, 106.6297],
  japan: [35.6762, 139.6503],
  tokyo: [35.6762, 139.6503],
  kyoto: [35.0116, 135.7681],
  maldives: [3.2028, 73.2207],
  srilanka: [7.8731, 80.7718],
  nepal: [28.3949, 84.1240],

  // Europe & Americas
  paris: [48.8566, 2.3522],
  france: [46.2276, 2.2137],
  london: [51.5074, -0.1278],
  uk: [55.3781, -3.4360],
  rome: [41.9028, 12.4964],
  italy: [41.8719, 12.5674],
  switzerland: [46.8182, 8.2275],
  zurich: [47.3769, 8.5417],
  amsterdam: [52.3676, 4.9041],
  barcelona: [41.3879, 2.1699],
  spain: [40.4637, -3.7492],
  greece: [39.0742, 21.8243],
  newyork: [40.7128, -74.0060],
  california: [36.7783, -119.4179],
  usa: [37.0902, -95.7129],
  sydney: [-33.8688, 151.2093],
  australia: [-25.2744, 133.7751],
};

const geocodeCache: Record<string, [number, number]> = {};

/**
 * Normalizes query string to lowercase alphanumeric key
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve coordinates for a query or destination.
 * Checks local dictionary -> memory cache -> Nominatim OpenStreetMap API.
 */
export async function geocodeLocation(
  queryStr: string,
  fallbackDestination?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const query = (queryStr || '').trim();
  if (!query) {
    if (fallbackDestination) {
      return geocodeLocation(fallbackDestination);
    }
    return null;
  }

  const key = normalizeKey(query);

  // 1. Direct dictionary match
  if (KNOWN_COORDINATES[key]) {
    const [lat, lng] = KNOWN_COORDINATES[key];
    return { lat, lng };
  }

  // 2. Partial dictionary match (e.g. "Bangkok, Thailand" or "Pattaya Beach")
  for (const [knownKey, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (key.includes(knownKey) || knownKey.includes(key)) {
      return { lat: coords[0], lng: coords[1] };
    }
  }

  // 3. Check in-memory cache
  if (geocodeCache[key]) {
    const [lat, lng] = geocodeCache[key];
    return { lat, lng };
  }

  // 4. Query OpenStreetMap Nominatim
  try {
    const fullQuery = fallbackDestination && !query.toLowerCase().includes(fallbackDestination.toLowerCase())
      ? `${query}, ${fallbackDestination}`
      : query;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        geocodeCache[key] = [lat, lng];
        return { lat, lng };
      }
    }
  } catch (err) {
    console.warn('Nominatim geocode failed, falling back:', err);
  }

  // 5. Fallback to destination if available
  if (fallbackDestination && fallbackDestination !== query) {
    return geocodeLocation(fallbackDestination);
  }

  return null;
}

/**
 * List of known template/sample activity titles to detect dummy data
 */
export const SAMPLE_ACTIVITY_LABELS = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'historic fort',
  'sunset cruise',
  'golden beach',
  'cultural museum',
  'waterfall hike',
  'spice market',
  'alibag beach & promenade',
  'kolaba sea fort',
  'varsoli white sand beach',
  'mandwa beach & water sports',
  'nagaon water sports bay',
  'kihim beach & coconut groves',
  'murud-janjira sea fortress',
]);

export function isSampleActivity(label: string): boolean {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return SAMPLE_ACTIVITY_LABELS.has(normalized);
}
