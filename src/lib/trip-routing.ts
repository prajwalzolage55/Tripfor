'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running inside a native mobile wrapper (Capacitor on Android/iOS).
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      Capacitor.isNativePlatform() ||
      window.location.protocol === 'capacitor:' ||
      (window.location.protocol === 'https:' && window.location.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

/**
 * Builds the appropriate path for navigating to a trip sub-page.
 * - In native Capacitor: Routes to `/trip/view/${subPath}?id=${tripId}` because static export
 *   only pre-renders `/trip/view/*`. Direct navigation to dynamic IDs causes Capacitor to 404
 *   and bounce back to index.html (the landing page).
 * - On web / Vercel: Routes to `/trip/${tripId}/${subPath}`.
 */
export function getTripPath(tripId: string, subPath: string = 'itinerary'): string {
  if (typeof window !== 'undefined' && tripId && tripId !== 'view') {
    try {
      localStorage.setItem('activeTripId', tripId);
    } catch {}
  }

  if (isNativePlatform()) {
    return `/trip/view/${subPath}?id=${tripId}`;
  }
  return `/trip/${tripId}/${subPath}`;
}

/**
 * Extracts the real trip ID from route parameters, query string (`?id=`), or local storage.
 * Resolves the issue where Capacitor loads `/trip/view/*` shell with id = 'view'.
 */
export function getEffectiveTripId(rawParamId?: string): string {
  if (rawParamId && rawParamId !== 'view') {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('activeTripId', rawParamId);
      } catch {}
    }
    return rawParamId;
  }

  if (typeof window !== 'undefined') {
    try {
      const searchParam = new URLSearchParams(window.location.search).get('id');
      if (searchParam && searchParam !== 'view') {
        localStorage.setItem('activeTripId', searchParam);
        return searchParam;
      }
      const stored = localStorage.getItem('activeTripId');
      if (stored && stored !== 'view') {
        return stored;
      }
    } catch {}
  }

  return rawParamId || '';
}

/**
 * Custom React hook for trip pages to reliably obtain the active tripId
 * across both dynamic serverless routes (web) and static pre-rendered routes (Capacitor).
 */
export function useTripId(): string {
  const params = useParams();
  const rawId = (params?.id as string) || '';
  const [tripId, setTripId] = useState<string>(() => getEffectiveTripId(rawId));

  useEffect(() => {
    const effective = getEffectiveTripId(rawId);
    if (effective && effective !== tripId) {
      setTripId(effective);
    }
  }, [rawId, tripId]);

  return tripId;
}
