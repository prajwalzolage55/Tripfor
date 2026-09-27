import { NextRequest, NextResponse } from 'next/server';
import { runDigitalTwinSimulation, PRESET_SCENARIOS, type WeatherSimParams } from '@/lib/weather-simulation';
import type { ItineraryItem } from '@/lib/types';
import type { LiveWeatherReport } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { params, items, baseWeather } = body;

    const simulationParams: WeatherSimParams = params || PRESET_SCENARIOS.live.params;
    const itineraryItems: ItineraryItem[] = items || [];
    const weather: LiveWeatherReport | null = baseWeather || null;

    const result = runDigitalTwinSimulation(simulationParams, itineraryItems, weather);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Weather simulation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to run weather simulation',
      },
      { status: 500 }
    );
  }
}
