'use client';

import { useEffect, useRef, useState } from 'react';
import type { ItineraryItem } from '@/lib/types';
import { geocodeLocation, KNOWN_COORDINATES } from '@/lib/geocoding';
import {
  Navigation,
  Maximize2,
  Plus,
  MapPin,
  Layers,
  Globe,
  Map as MapIcon,
  Compass,
} from 'lucide-react';

interface ItineraryMapProps {
  items: ItineraryItem[];
  highlightedItemId?: string | null;
  onMarkerClick?: (itemId: string) => void;
  dayTitle?: string;
  destination?: string | null;
  onAddLocationClick?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
}

export type MapLayerType = 'hybrid' | 'satellite' | 'street';

interface LayerConfig {
  name: string;
  icon: typeof MapIcon;
  url: string;
  subdomains: string[];
  maxZoom: number;
  attribution: string;
}

const MAP_LAYERS: Record<MapLayerType, LayerConfig> = {
  hybrid: {
    name: 'Hybrid',
    icon: Layers,
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  satellite: {
    name: 'Satellite',
    icon: Globe,
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  street: {
    name: 'Street',
    icon: MapIcon,
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  activity: '#4f46e5',
  dining: '#f59e0b',
  hotel: '#8b5cf6',
  transfer: '#0d9488',
  flight: '#0284c7',
  other: '#64748b',
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
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('hybrid');
  const [resolvedCenter, setResolvedCenter] = useState<[number, number]>(() => {
    if (destination) {
      const clean = destination.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (KNOWN_COORDINATES[clean]) return KNOWN_COORDINATES[clean];
      for (const [k, v] of Object.entries(KNOWN_COORDINATES)) {
        if (clean.includes(k) || k.includes(clean)) return v;
      }
    }
    return [13.7563, 100.5018]; // Default to Thailand center
  });

  // Extract items with valid coordinates
  const geoItems = items.filter(
    item =>
      item.location &&
      typeof item.location.latitude === 'number' &&
      typeof item.location.longitude === 'number' &&
      !isNaN(item.location.latitude) &&
      !isNaN(item.location.longitude)
  );

  // Dynamic geocoding for destination if not in standard dictionary
  useEffect(() => {
    let cancelled = false;
    if (destination) {
      geocodeLocation(destination).then(res => {
        if (!cancelled && res) {
          const coords: [number, number] = [res.lat, res.lng];
          setResolvedCenter(coords);
          if (mapInstanceRef.current && geoItems.length === 0) {
            mapInstanceRef.current.setView(coords, 11, { animate: true });
          }
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [destination, geoItems.length]);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;

      const initialCenter: [number, number] =
        geoItems.length > 0 && geoItems[0].location?.latitude && geoItems[0].location?.longitude
          ? [geoItems[0].location.latitude, geoItems[0].location.longitude]
          : resolvedCenter;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        zoomControl: false, // We use a clean custom layout
        scrollWheelZoom: true,
      });

      // Add Google Tile Layer
      const initialLayerConfig = MAP_LAYERS[activeLayer];
      const tileLayer = L.tileLayer(initialLayerConfig.url, {
        subdomains: initialLayerConfig.subdomains,
        maxZoom: initialLayerConfig.maxZoom,
        attribution: initialLayerConfig.attribution,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Add default zoom control to bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Handle map clicks for custom pin placement
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;

        // Visual click ping marker
        if (clickMarkerRef.current) {
          clickMarkerRef.current.remove();
        }

        const clickIcon = L.divIcon({
          className: 'click-ping-marker',
          html: `
            <div style="position: relative; width: 28px; height: 28px;">
              <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(99, 102, 241, 0.4); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: #4f46e5; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.4);"></span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const newMarker = L.marker([lat, lng], { icon: clickIcon }).addTo(map);
        newMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 2px;">
            <div style="font-weight: 700; color: #4f46e5; margin-bottom: 2px;">Selected Pin</div>
            <div style="color: #64748b; font-size: 11px;">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          </div>
        `).openPopup();
        clickMarkerRef.current = newMarker;

        if (onMapClick) {
          onMapClick(lat, lng);
        }
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Handle Layer Switching (Street, Satellite, Hybrid)
  function handleLayerChange(type: MapLayerType) {
    setActiveLayer(type);
    if (tileLayerRef.current) {
      const config = MAP_LAYERS[type];
      tileLayerRef.current.setUrl(config.url);
    }
  }

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
        map.setView(resolvedCenter, 11);
        return;
      }

      const coordinates: [number, number][] = [];

      geoItems.forEach((item, index) => {
        const lat = item.location!.latitude!;
        const lng = item.location!.longitude!;
        coordinates.push([lat, lng]);

        const color = CATEGORY_COLORS[item.type] || '#4f46e5';
        const isSelected = highlightedItemId === item.id;

        // Custom HTML Pin Marker with high-contrast badge
        const customIcon = L.divIcon({
          className: 'itinerary-custom-marker',
          html: `
            <div style="
              width: ${isSelected ? '38px' : '32px'};
              height: ${isSelected ? '38px' : '32px'};
              background: ${color};
              color: #ffffff;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 16px rgba(0,0,0,0.6);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '14px' : '12px'};
              font-weight: 800;
              transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              cursor: pointer;
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const popupContent = `
          <div style="font-family: inherit; padding: 4px 2px; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${color}; letter-spacing: 0.5px; margin-bottom: 2px;">
              Stop ${index + 1} • ${item.type}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
              ${item.label}
            </div>
            ${item.location?.address ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 5px;">${item.location.address}</div>` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 5px; margin-top: 3px;">
              <span style="font-weight: 700; color: #1e293b;">${item.cost > 0 ? '₹' + item.cost.toLocaleString('en-IN') : 'Free'}</span>
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

      // Draw connecting route polyline
      if (coordinates.length > 1) {
        polylineRef.current = L.polyline(coordinates, {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.9,
          dashArray: '6, 8',
          lineJoin: 'round',
        }).addTo(map);
      }

      // Auto-fit bounds
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }

    updateMarkers();
  }, [items, mapLoaded, highlightedItemId, geoItems.length, onMarkerClick, resolvedCenter]);

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
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } else {
      mapInstanceRef.current.setView(resolvedCenter, 11, { animate: true });
    }
  }

  return (
    <div className="relative w-full h-[400px] lg:h-[460px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-md bg-slate-900">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Destination & Stops Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg text-xs font-semibold text-white">
        <Navigation className="w-3.5 h-3.5 text-sky-400" />
        <span>{destination ? `${destination} Map` : dayTitle ? `${dayTitle} Route` : 'Interactive Route'}</span>
        <span className="text-slate-500">•</span>
        <span className="text-sky-400 font-bold">{geoItems.length} Stops Plotted</span>
      </div>

      {/* Top Right: Google Maps Style Layer Switcher (Street / Satellite / Hybrid) */}
      <div className="absolute top-3 right-3 z-10 flex items-center bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg gap-1">
        {(Object.keys(MAP_LAYERS) as MapLayerType[]).map(type => {
          const config = MAP_LAYERS[type];
          const Icon = config.icon;
          const isActive = activeLayer === type;
          return (
            <button
              key={type}
              onClick={() => handleLayerChange(type)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={`Switch to Google ${config.name} View`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{config.name}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Right: Reset / Recenter Button */}
      <button
        onClick={handleResetView}
        className="absolute bottom-12 right-3 z-10 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg text-xs font-medium text-white hover:bg-slate-800 transition"
        title="Reset map view to destination"
      >
        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
        <span>Recenter</span>
      </button>

      {/* Bottom Left Guidance Bar when 0 items exist */}
      {geoItems.length === 0 && mapLoaded && (
        <div className="absolute bottom-3 left-3 z-10 max-w-sm flex flex-col gap-2 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shadow-xl text-white">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <MapPin className="w-4 h-4 text-sky-400" />
            <span>Map ready for {destination || 'your destination'}!</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            Click anywhere on the map or tap below to plot an activity pin.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {onAddLocationClick && (
              <button
                onClick={onAddLocationClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
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
