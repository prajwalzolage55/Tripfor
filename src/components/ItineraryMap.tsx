'use client';

import { useEffect, useRef, useState } from 'react';
import type { ItineraryItem } from '@/lib/types';
import { Navigation, Maximize2, Sparkles, Plus, MapPin } from 'lucide-react';

interface ItineraryMapProps {
  items: ItineraryItem[];
  highlightedItemId?: string | null;
  onMarkerClick?: (itemId: string) => void;
  dayTitle?: string;
  destination?: string | null;
  onAddLocationClick?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const DESTINATION_CENTERS: Record<string, [number, number]> = {
  alibag: [18.6414, 72.8722],
  alibaug: [18.6414, 72.8722],
  goa: [15.4989, 73.8278],
  mumbai: [18.9220, 72.8347],
  delhi: [28.6139, 77.2090],
  bangalore: [12.9716, 77.5946],
  paris: [48.8566, 2.3522],
  tokyo: [35.6762, 139.6503],
  bali: [-8.4095, 115.1889],
  newyork: [40.7128, -74.0060],
};

const CATEGORY_COLORS: Record<string, string> = {
  activity: '#4c6ef5',
  dining: '#d97706',
  hotel: '#7c3aed',
  transfer: '#0d9488',
  flight: '#2563eb',
  other: '#475569',
};

export default function ItineraryMap({
  items,
  highlightedItemId,
  onMarkerClick,
  dayTitle,
  destination,
  onAddLocationClick,
  onMapClick,
}: ItineraryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Extract valid items with coordinates
  const geoItems = items.filter(
    item =>
      item.location &&
      typeof item.location.latitude === 'number' &&
      typeof item.location.longitude === 'number'
  );

  // Determine initial center
  const destKey = (destination || '').toLowerCase().replace(/[^a-z]/g, '');
  const destCenter = DESTINATION_CENTERS[destKey] || [18.6414, 72.8722];

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;

      const initialCenter: [number, number] = geoItems.length > 0 && geoItems[0].location
        ? [geoItems[0].location.latitude!, geoItems[0].location.longitude!]
        : destCenter;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Standard OpenStreetMap tiles (100% free, reliable, no API key needed)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Handle map click to place pin
      map.on('click', (e: any) => {
        if (onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);

      // Force recalculation of container size after mounting
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 300);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Route Lines
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    map.invalidateSize();

    async function updateMarkers() {
      const L = (await import('leaflet')).default;

      // Clear existing markers & polyline
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (geoItems.length === 0) {
        map.setView(destCenter, 13);
        return;
      }

      const coordinates: [number, number][] = [];

      geoItems.forEach((item, index) => {
        const lat = item.location!.latitude!;
        const lng = item.location!.longitude!;
        coordinates.push([lat, lng]);

        const color = CATEGORY_COLORS[item.type] || '#4c6ef5';
        const isSelected = highlightedItemId === item.id;

        // Custom HTML Pin Marker
        const customIcon = L.divIcon({
          className: 'itinerary-custom-marker',
          html: `
            <div style="
              width: ${isSelected ? '36px' : '30px'};
              height: ${isSelected ? '36px' : '30px'};
              background: ${color};
              color: #ffffff;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 14px rgba(0,0,0,0.35);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '14px' : '12px'};
              font-weight: 700;
              transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const popupContent = `
          <div style="font-family: inherit; padding: 4px 2px; min-width: 170px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${color}; letter-spacing: 0.5px; margin-bottom: 2px;">
              Stop ${index + 1} • ${item.type}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
              ${item.label}
            </div>
            ${item.location?.address ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${item.location.address}</div>` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
              <span style="font-weight: 600; color: #334155;">${item.cost > 0 ? '₹' + item.cost : 'Free'}</span>
              <span style="color: #64748b;">${item.estimated_travel_time ? '🚗 ' + item.estimated_travel_time : ''}</span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { offset: [0, -10] });

        marker.on('click', () => {
          if (onMarkerClick) {
            onMarkerClick(item.id);
          }
        });

        markersRef.current[item.id] = marker;
      });

      // Draw connecting polyline
      if (coordinates.length > 1) {
        polylineRef.current = L.polyline(coordinates, {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
          lineJoin: 'round',
        }).addTo(map);
      }

      // Auto-fit bounds
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      }
    }

    updateMarkers();
  }, [items, mapLoaded, highlightedItemId, geoItems.length, onMarkerClick, destCenter]);

  // Center on highlighted item if changed
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !highlightedItemId) return;
    const marker = markersRef.current[highlightedItemId];
    if (marker) {
      marker.openPopup();
      mapInstanceRef.current.panTo(marker.getLatLng(), { animate: true });
    }
  }, [highlightedItemId, mapLoaded]);

  function handleResetView() {
    if (!mapInstanceRef.current) return;
    if (geoItems.length > 0) {
      const coordinates: [number, number][] = geoItems.map(item => [
        item.location!.latitude!,
        item.location!.longitude!,
      ]);
      const L = (window as any).L;
      if (L) {
        const bounds = L.latLngBounds(coordinates);
        mapInstanceRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      }
    } else {
      mapInstanceRef.current.setView(destCenter, 13);
    }
  }

  return (
    <div className="relative w-full h-[380px] lg:h-[440px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-100">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Info Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200/90 shadow-xs text-xs font-semibold text-slate-800">
        <Navigation className="w-3.5 h-3.5 text-indigo-600" />
        <span>{destination ? `${destination} Map` : dayTitle ? `${dayTitle} Route` : 'Interactive Route'}</span>
        <span className="text-slate-300">•</span>
        <span className="text-indigo-600 font-bold">{geoItems.length} Stops Plotted</span>
      </div>

      {/* Map Reset / Recenter Button */}
      <button
        onClick={handleResetView}
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        title="Reset map view"
      >
        <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
        <span>Recenter</span>
      </button>

      {/* Non-intrusive bottom guidance bar when 0 items exist (MAP REMAINS 100% VISIBLE) */}
      {geoItems.length === 0 && mapLoaded && (
        <div className="absolute bottom-3 left-3 z-10 max-w-sm flex flex-col gap-2 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/90 shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <span>Map is ready for {destination || 'your destination'}!</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Click anywhere on the map or click below to place your first activity pin.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {onAddLocationClick && (
              <button
                onClick={onAddLocationClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Add Activity Pin</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
