import { NextRequest, NextResponse } from 'next/server';
import {
  getDestinationSocialSignals,
  analyzeSocialSignals,
  type SocialSignal,
} from '@/lib/social-signals';

export const dynamic = 'force-dynamic';

// In-memory persistent cache for user-submitted signals during runtime
const submittedSignalsMap = new Map<string, SocialSignal[]>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination') || searchParams.get('city') || 'Goa';

    const baseSignals = getDestinationSocialSignals(destination);
    const customSignals = submittedSignalsMap.get(destination.toLowerCase()) || [];
    const allSignals = [...customSignals, ...baseSignals];

    const summary = analyzeSocialSignals(allSignals);

    return NextResponse.json({
      success: true,
      data: {
        destination,
        signals: allSignals,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Social Signals API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch social signals',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destination, content, location_name, author_name, role, sentiment, coords, anomaly_detected } = body;

    const destKey = (destination || 'Goa').toLowerCase();

    const newSignal: SocialSignal = {
      id: `user-sig-${Date.now()}`,
      source: 'community_report',
      platform_name: 'Verified Traveler Signal',
      author: {
        name: author_name || 'Traveler Observer',
        handle: `@${(author_name || 'traveler').toLowerCase().replace(/\s+/g, '_')}`,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        verified: true,
        role: role || 'Traveler',
      },
      content: content || 'Live field observation submitted.',
      timestamp: 'Just now',
      location_name: location_name || destination || 'On Site',
      coords: coords || { lat: 34.1526, lon: 77.5771 },
      sentiment: sentiment || 'positive',
      sentiment_score: sentiment === 'positive' ? 95 : sentiment === 'caution' ? 60 : 40,
      tags: ['#LiveFieldReport', '#CommunityAlert', '#DigitalTwin'],
      metrics: {
        likes: 1,
        shares: 0,
        corroborations: 1,
      },
      anomaly_detected: Boolean(anomaly_detected),
      anomaly_description: anomaly_detected ? 'User-reported local weather deviation.' : undefined,
    };

    const existing = submittedSignalsMap.get(destKey) || [];
    submittedSignalsMap.set(destKey, [newSignal, ...existing]);

    const baseSignals = getDestinationSocialSignals(destination);
    const allSignals = [newSignal, ...existing, ...baseSignals];
    const summary = analyzeSocialSignals(allSignals);

    return NextResponse.json({
      success: true,
      data: {
        newSignal,
        signals: allSignals,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Submit social signal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to submit social signal',
      },
      { status: 500 }
    );
  }
}
