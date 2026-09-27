import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination') || searchParams.get('city') || 'Leh, Ladakh';
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');

    const lat = latParam ? parseFloat(latParam) : undefined;
    const lon = lonParam ? parseFloat(lonParam) : undefined;

    const report = await fetchLiveWeather(destination, lat, lon);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch weather data',
      },
      { status: 500 }
    );
  }
}
