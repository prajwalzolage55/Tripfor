/**
 * Weather Digital Twin Counterfactual & What-If Simulation Engine
 * Simulates micro-climatic disruptions (rainfall intensity, temperature shifts, storm duration, wind velocity)
 * and propagates secondary and higher-order cascading effects across travel operations.
 */

import type { ItineraryItem } from '@/lib/types';
import type { LiveWeatherReport } from '@/lib/weather';

export interface WeatherSimParams {
  rain_intensity_mm: number; // 0 to 80 mm/h
  temperature_c: number; // -15 to 45 °C
  wind_speed_kmh: number; // 0 to 90 km/h
  storm_duration_hours: number; // 1 to 24 h
  propagation_radius_km: number; // 5 to 60 km
  scenario_preset: 'live' | 'blizzard' | 'cloudburst' | 'heatwave' | 'fog_inversion' | 'custom';
}

export interface EntitySimImpact {
  itemId: string;
  itemLabel: string;
  itemType: string;
  originalRisk: 'optimal' | 'moderate' | 'high' | 'severe';
  simulatedRisk: 'optimal' | 'moderate' | 'high' | 'severe';
  transitDelayMinutes: number;
  operationalStatus: string;
  visitorDemandPctChange: number; // e.g. -80% or +150%
  rescheduleRecommended: boolean;
  mitigationAlternative: string;
  downstreamCascade: string;
}

export interface WeatherSimulationResult {
  params: WeatherSimParams;
  overall_system_viability_score: number; // 0 to 100
  ecosystem_risk_level: 'optimal' | 'moderate' | 'high' | 'severe';
  transit_disruption_index: number; // 0 - 100
  attraction_demand_shift: number; // e.g. -70%
  dining_indoor_surge: number; // e.g. +140%
  hotel_capacity_strain: number; // e.g. +45%
  impacted_entities: EntitySimImpact[];
  probabilistic_forecast: {
    pass_closure_probability: number; // 0 - 1
    delay_propagation_confidence: number; // 0 - 1
    estimated_recovery_hours: number;
  };
  recommended_twin_actions: string[];
}

export const PRESET_SCENARIOS: Record<
  string,
  { name: string; description: string; params: WeatherSimParams }
> = {
  live: {
    name: 'Current Live Baseline',
    description: 'Real-time OpenWeather observations and normal travel flow.',
    params: {
      rain_intensity_mm: 0,
      temperature_c: 13,
      wind_speed_kmh: 8,
      storm_duration_hours: 1,
      propagation_radius_km: 15,
      scenario_preset: 'live',
    },
  },
  blizzard: {
    name: 'High-Altitude Mountain Blizzard',
    description: 'Sub-zero freezing storm (-8°C), 45mm snowfall rate, and 65km/h gale gusts across high mountain passes.',
    params: {
      rain_intensity_mm: 45,
      temperature_c: -8,
      wind_speed_kmh: 65,
      storm_duration_hours: 6,
      propagation_radius_km: 35,
      scenario_preset: 'blizzard',
    },
  },
  cloudburst: {
    name: 'Monsoonal Flash Cloudburst',
    description: 'Intense torrential precipitation (55mm/h) causing localized road washouts and outdoor tour suspensions.',
    params: {
      rain_intensity_mm: 55,
      temperature_c: 16,
      wind_speed_kmh: 42,
      storm_duration_hours: 4,
      propagation_radius_km: 28,
      scenario_preset: 'cloudburst',
    },
  },
  heatwave: {
    name: 'Extreme Solar Radiation & Heatwave',
    description: 'High heat (39°C) with intense UV exposure causing midday attraction avoidance and hydration demand surges.',
    params: {
      rain_intensity_mm: 0,
      temperature_c: 39,
      wind_speed_kmh: 6,
      storm_duration_hours: 8,
      propagation_radius_km: 25,
      scenario_preset: 'heatwave',
    },
  },
  fog_inversion: {
    name: 'Dense Valley Fog & Inversion Layer',
    description: 'Near-zero visibility (<150m) and freezing mist delaying airport arrivals and mountain convoy transit.',
    params: {
      rain_intensity_mm: 3,
      temperature_c: 1,
      wind_speed_kmh: 4,
      storm_duration_hours: 10,
      propagation_radius_km: 40,
      scenario_preset: 'fog_inversion',
    },
  },
};

/**
 * Runs the counterfactual Digital Twin simulation across the trip's items
 */
export function runDigitalTwinSimulation(
  params: WeatherSimParams,
  items: ItineraryItem[],
  baseWeather: LiveWeatherReport | null
): WeatherSimulationResult {
  const {
    rain_intensity_mm,
    temperature_c,
    wind_speed_kmh,
    storm_duration_hours,
    propagation_radius_km,
  } = params;

  // 1. Calculate environmental severity score (0 to 100)
  let severityScore = 0;
  if (rain_intensity_mm > 0) severityScore += Math.min(rain_intensity_mm * 1.3, 50);
  if (wind_speed_kmh > 20) severityScore += Math.min((wind_speed_kmh - 20) * 0.9, 30);
  if (temperature_c < 0) severityScore += Math.min(Math.abs(temperature_c) * 2.2, 35);
  else if (temperature_c > 35) severityScore += Math.min((temperature_c - 35) * 3, 30);
  if (storm_duration_hours > 3) severityScore += Math.min(storm_duration_hours * 1.5, 20);

  const normalizedSeverity = Math.min(Math.max(severityScore, 0), 100);
  const viabilityScore = Math.max(10, Math.round(100 - normalizedSeverity));

  let ecosystemRisk: 'optimal' | 'moderate' | 'high' | 'severe' = 'optimal';
  if (normalizedSeverity > 70) ecosystemRisk = 'severe';
  else if (normalizedSeverity > 40) ecosystemRisk = 'high';
  else if (normalizedSeverity > 18) ecosystemRisk = 'moderate';

  // 2. Domain-specific macro indices
  const transitDisruption = Math.min(
    100,
    Math.round(rain_intensity_mm * 1.2 + (wind_speed_kmh > 30 ? (wind_speed_kmh - 30) * 1.4 : 0) + (temperature_c < 0 ? 30 : 0))
  );

  const attractionDemandShift = Math.max(
    -95,
    Math.round(-1 * (rain_intensity_mm * 1.5 + (temperature_c < 0 ? 35 : 0) + (wind_speed_kmh > 35 ? 25 : 0)))
  );

  const diningIndoorSurge = Math.min(
    200,
    Math.round(rain_intensity_mm * 2.4 + (temperature_c < 5 ? 40 : 0) + (wind_speed_kmh > 30 ? 25 : 0))
  );

  const hotelCapacityStrain = Math.min(
    100,
    Math.round((transitDisruption > 50 ? 45 : 10) + (temperature_c < 2 ? 35 : 0))
  );

  // 3. Propagate to individual itinerary entities
  const impactedEntities: EntitySimImpact[] = items.map((item, index) => {
    let simRisk: 'optimal' | 'moderate' | 'high' | 'severe' = 'optimal';
    let delayMin = 0;
    let operationalStatus = 'Standard operations within normal parameters.';
    let demandShift = 0;
    let reschedule = false;
    let mitigation = 'No operational changes required.';
    let ripple = 'Schedule milestone on time.';

    const isHighAltitudeOrOutdoor =
      item.type === 'activity' ||
      item.label.toLowerCase().includes('pass') ||
      item.label.toLowerCase().includes('stupa') ||
      item.label.toLowerCase().includes('trek');

    if (item.type === 'transfer' || item.type === 'flight') {
      if (normalizedSeverity > 65) {
        simRisk = 'severe';
        delayMin = Math.min(180, Math.round(storm_duration_hours * 25 + 45));
        operationalStatus = 'Pass Closure / Ground Convoy Halt: Road impassable due to severe conditions.';
        reschedule = true;
        mitigation = 'Activate emergency southern bypass or postpone departure by 4 hours.';
        ripple = `+${delayMin}m delay cascades into subsequent Day schedule stops.`;
      } else if (normalizedSeverity > 30) {
        simRisk = 'high';
        delayMin = Math.round(25 + storm_duration_hours * 8);
        operationalStatus = 'Reduced Road Velocity: Chains required; transit corridors experiencing heavy congestion.';
        reschedule = false;
        mitigation = 'Mandate 4WD convoy transit with +40m buffer.';
        ripple = `Subsequent arrival shifted by +${delayMin} minutes.`;
      } else if (normalizedSeverity > 15) {
        simRisk = 'moderate';
        delayMin = 15;
        operationalStatus = 'Moderate Weather Buffer: Wet road surface; minor speed deceleration.';
        mitigation = 'Standard caution advisory for drivers.';
        ripple = 'Delay absorbed within standard itinerary padding.';
      }
    } else if (item.type === 'activity') {
      if (normalizedSeverity > 55) {
        simRisk = 'severe';
        demandShift = -85;
        operationalStatus = 'Outdoor Activity Suspended: Extreme weather hazard; safety perimeter active.';
        reschedule = true;
        mitigation = 'Swap with indoor cultural museum, artisan center, or heated heritage hall.';
        ripple = 'Activity cancelled for the day; budget allocation redirected to indoor experiences.';
      } else if (normalizedSeverity > 25) {
        simRisk = 'moderate';
        demandShift = -35;
        operationalStatus = 'Inclement Weather Exposure: High wind gusts and reduced viewing visibility.';
        reschedule = false;
        mitigation = 'Shorten outdoor excursion duration to 45m; verify thermal gear.';
        ripple = 'May require early return to vehicle.';
      } else {
        demandShift = +10;
        operationalStatus = 'Optimal Outdoor Sightseeing.';
      }
    } else if (item.type === 'dining') {
      if (rain_intensity_mm > 15 || temperature_c < 5) {
        simRisk = normalizedSeverity > 50 ? 'high' : 'moderate';
        demandShift = diningIndoorSurge;
        operationalStatus = `Outdoor Patio Closed: Indoor dining surge at +${diningIndoorSurge}% capacity.`;
        delayMin = 25;
        mitigation = 'Automate pre-booking for heated indoor tables 2 hours in advance.';
        ripple = `Dining turnaround +${delayMin}m wait time.`;
      }
    } else if (item.type === 'hotel') {
      if (temperature_c < 2 || normalizedSeverity > 60) {
        simRisk = 'moderate';
        demandShift = hotelCapacityStrain;
        operationalStatus = 'High Check-In Strain: Radiant heating and auxiliary generators operating at capacity.';
        mitigation = 'Confirm room thermal status and hot water reserves prior to arrival.';
        ripple = 'Safe haven operations nominal.';
      }
    }

    return {
      itemId: item.id,
      itemLabel: item.label,
      itemType: item.type,
      originalRisk: 'optimal',
      simulatedRisk: simRisk,
      transitDelayMinutes: delayMin,
      operationalStatus,
      visitorDemandPctChange: demandShift,
      rescheduleRecommended: reschedule,
      mitigationAlternative: mitigation,
      downstreamCascade: ripple,
    };
  });

  // 4. Probabilistic predictions
  const passClosureProb = normalizedSeverity > 60 ? Math.min(0.98, 0.4 + (normalizedSeverity - 60) * 0.015) : 0.08;
  const confidence = Math.min(0.96, Math.max(0.75, 0.94 - (storm_duration_hours * 0.01)));
  const recoveryHours = Math.round(storm_duration_hours * 1.4 + (rain_intensity_mm > 30 ? 3 : 1));

  // 5. Automated Digital Twin System Recommendations
  const actions: string[] = [];
  if (transitDisruption > 40) {
    actions.push(`Transit Corridors: Implement automated +${Math.round(transitDisruption * 0.8)}m safety buffer on all Day transfers.`);
  }
  if (passClosureProb > 0.5) {
    actions.push(`Mountain Pass Alert: Re-route planned convoy via lower elevation bypass; avoid high summits.`);
  }
  if (diningIndoorSurge > 60) {
    actions.push(`Dining Redirection: Pre-reserve indoor restaurant seating to bypass expected ${diningIndoorSurge}% crowd surge.`);
  }
  if (attractionDemandShift < -50) {
    actions.push(`Itinerary Auto-Swap: Activate sheltered indoor alternatives for impacted outdoor activities.`);
  }
  if (actions.length === 0) {
    actions.push('System Operating in Optimal Weather Envelope. Maintain scheduled itinerary timings.');
  }

  return {
    params,
    overall_system_viability_score: viabilityScore,
    ecosystem_risk_level: ecosystemRisk,
    transit_disruption_index: transitDisruption,
    attraction_demand_shift: attractionDemandShift,
    dining_indoor_surge: diningIndoorSurge,
    hotel_capacity_strain: hotelCapacityStrain,
    impacted_entities: impactedEntities,
    probabilistic_forecast: {
      pass_closure_probability: Math.round(passClosureProb * 100) / 100,
      delay_propagation_confidence: Math.round(confidence * 100) / 100,
      estimated_recovery_hours: recoveryHours,
    },
    recommended_twin_actions: actions,
  };
}
