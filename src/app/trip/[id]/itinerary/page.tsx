'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDoc, getDocs, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import type {
  ItineraryItem,
  TripMember,
  ItemParticipant,
  ItemType,
  SplitType,
  Trip,
  TripPreferences,
  ItineraryDayRecord,
  LocationRecord,
} from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { recalculateDaySequence, ALTERNATIVE_LOCATIONS } from '@/lib/itinerary-recalculate';
import ItineraryMap from '@/components/ItineraryMap';
import { geocodeLocation, isSampleActivity } from '@/lib/geocoding';
import { appendEvent } from '@/lib/ledger';
import {
  fetchLiveWeather,
  type LiveWeatherReport,
  type DailyForecast,
  OPENWEATHER_API_KEY,
} from '@/lib/weather';
import { getDestinationSocialSignals } from '@/lib/social-signals';
import {
  Plus, Plane, Hotel, Activity, Car, UtensilsCrossed, MoreHorizontal,
  Calendar, DollarSign, Users, X, Trash2, Edit3, Check, Ban, Loader2,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Sparkles, Navigation,
  Compass, MapPin, RefreshCw, Sun, CloudRain, ShieldAlert,
  ArrowUp, ArrowDown, Map as MapIcon, Columns, CalendarDays, CheckCircle2,
  Copy, Droplets, Wind, Zap, Thermometer, Cloud
} from 'lucide-react';

const COLORS = {
  burgundy: '#791523',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#b83a4b'
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 15 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.2 } }
};

const drawerVariants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 30 }
  },
  exit: {
    x: '100%',
    transition: { duration: 0.2, ease: 'easeInOut' as const }
  }
};

const TYPE_CONFIG: Record<ItemType, { label: string; icon: typeof Activity; bg: string; color: string; border: string }> = {
  activity: {
    label: 'Attraction / Activity',
    icon: Activity,
    bg: 'rgba(116, 143, 252, 0.12)',
    color: '#4c6ef5',
    border: 'rgba(116, 143, 252, 0.25)',
  },
  dining: {
    label: 'Dining & Food',
    icon: UtensilsCrossed,
    bg: 'rgba(250, 176, 5, 0.12)',
    color: '#d97706',
    border: 'rgba(250, 176, 5, 0.25)',
  },
  hotel: {
    label: 'Accommodation',
    icon: Hotel,
    bg: 'rgba(139, 92, 246, 0.12)',
    color: '#7c3aed',
    border: 'rgba(139, 92, 246, 0.25)',
  },
  transfer: {
    label: 'Transit / Transfer',
    icon: Car,
    bg: 'rgba(20, 184, 166, 0.12)',
    color: '#0d9488',
    border: 'rgba(20, 184, 166, 0.25)',
  },
  flight: {
    label: 'Flight',
    icon: Plane,
    bg: 'rgba(59, 130, 246, 0.12)',
    color: '#2563eb',
    border: 'rgba(59, 130, 246, 0.25)',
  },
  other: {
    label: 'Other',
    icon: MoreHorizontal,
    bg: 'rgba(100, 116, 139, 0.12)',
    color: '#475569',
    border: 'rgba(100, 116, 139, 0.25)',
  },
};

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Split Equally' },
  { value: 'flat_per_person', label: 'Flat Per Person' },
  { value: 'per_night', label: 'Per Night' },
  { value: 'percentage', label: 'By Percentage' },
  { value: 'organizer_paid', label: 'Organizer Paid (no split)' },
];

export default function ItineraryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [days, setDays] = useState<ItineraryDayRecord[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, ItemParticipant[]>>({});

  const [loading, setLoading] = useState(true);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all'); // 'all' or day.id
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'split' | 'timeline' | 'map'>('split');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDayId, setFormDayId] = useState<string>('');
  const [formType, setFormType] = useState<ItemType>('activity');
  const [formLabel, setFormLabel] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formSplitType, setFormSplitType] = useState<SplitType>('equal');
  const [formSelectedMembers, setFormSelectedMembers] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState('');
  
  // Location inputs in Modal
  const [formLocationName, setFormLocationName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLatitude, setFormLatitude] = useState('');
  const [formLongitude, setFormLongitude] = useState('');
  const [geocodingLoc, setGeocodingLoc] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Swap / Alternatives Modal State
  const [swappingItem, setSwappingItem] = useState<ItineraryItem | null>(null);
  const [movingDayItem, setMovingDayItem] = useState<ItineraryItem | null>(null);

  // Weather & Digital Twin State (Live meteorological data from OpenWeather)
  const [weatherReport, setWeatherReport] = useState<LiveWeatherReport | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showWeatherDetails, setShowWeatherDetails] = useState(true);
  const socialSignals = useMemo(
    () => getDestinationSocialSignals(trip?.destination || trip?.name || '', weatherReport),
    [trip?.destination, trip?.name, weatherReport]
  );

  // Load everything
  const loadData = useCallback(async () => {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (tripDoc.exists()) setTrip({ id: tripDoc.id, ...tripDoc.data() } as unknown as Trip);
      
      const prefsQ = query(collection(db, 'trip_preferences'), where('trip_id', '==', tripId));
      const prefsRes = await getDocs(prefsQ);
      if (!prefsRes.empty) setPreferences({ id: prefsRes.docs[0].id, ...prefsRes.docs[0].data() } as unknown as TripPreferences);
      
      const daysQ = query(collection(db, 'itinerary_days'), where('trip_id', '==', tripId));
      const itemsQ = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId));
      const memQ = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));
      const locQ = query(collection(db, 'locations')); // Load all locations for now, or just the ones needed

      const [daysRes, itemsRes, membersRes, locRes] = await Promise.all([
        getDocs(daysQ),
        getDocs(itemsQ),
        getDocs(memQ),
        getDocs(locQ),
      ]);

      const loadedDays = daysRes.docs
        .map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryDayRecord))
        .sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0));
      let loadedItems = itemsRes.docs
        .map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryItem))
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      const loadedMembers = membersRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));
      
      const locMap: Record<string, any> = {};
      locRes.docs.forEach(d => locMap[d.id] = { id: d.id, ...d.data() });
      loadedItems = loadedItems.map(item => ({
        ...item,
        location: item.location_id ? locMap[item.location_id] : undefined
      }));

      // Auto-heal items without coordinates (e.g. user items with destination "THAILAND")
      const destName = tripDoc.exists() ? (tripDoc.data()?.destination || '') : '';
      const itemsToUpdateCoords: { item: ItineraryItem; lat: number; lng: number }[] = [];
      for (const item of loadedItems) {
        const hasCoords =
          item.location &&
          typeof item.location.latitude === 'number' &&
          typeof item.location.longitude === 'number' &&
          !isNaN(item.location.latitude) &&
          !isNaN(item.location.longitude);

        if (!hasCoords && item.status === 'active') {
          const locName = item.location?.name || item.location?.address || item.label;
          const resolved = await geocodeLocation(locName, destName);
          if (resolved) {
            item.location = {
              ...(item.location || {
                id: item.location_id || crypto.randomUUID(),
                name: locName,
                category: 'activity' as const,
                description: null,
                address: null,
                opening_hours: null,
                recommended_duration: null,
                entry_fee: 0,
                estimated_spending: 0,
                rating: null,
                best_time_to_visit: null,
                created_at: new Date().toISOString(),
              }),
              latitude: resolved.lat,
              longitude: resolved.lng,
            };
            itemsToUpdateCoords.push({ item, lat: resolved.lat, lng: resolved.lng });
          }
        }
      }

      setDays(loadedDays);
      setItems(loadedItems);
      setMembers(loadedMembers);

      // Persist healed coordinates in Firestore asynchronously
      if (itemsToUpdateCoords.length > 0) {
        (async () => {
          try {
            for (const { item, lat, lng } of itemsToUpdateCoords) {
              const locId = item.location_id || item.location?.id || crypto.randomUUID();
              await setDoc(doc(db, 'locations', locId), {
                id: locId,
                name: item.location?.name || item.label,
                category: item.type === 'dining' ? 'restaurant' : 'attraction',
                latitude: lat,
                longitude: lng,
              }, { merge: true });

              if (!item.location_id) {
                await setDoc(doc(db, 'itinerary_items', item.id), {
                  location_id: locId,
                }, { merge: true });
              }
            }
          } catch (e) {
            console.warn('Failed to persist healed coordinates:', e);
          }
        })();
      }

      // Load participants
      if (loadedItems.length > 0) {
        const partsQ = query(collection(db, 'item_participants'));
        const partsRes = await getDocs(partsQ);
        const parts = partsRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItemParticipant));
        const activeIds = new Set(loadedItems.map(i => i.id));
        const map: Record<string, ItemParticipant[]> = {};
        parts.forEach(p => {
          if (activeIds.has(p.item_id)) {
            if (!map[p.item_id]) map[p.item_id] = [];
            map[p.item_id].push(p);
          }
        });
        setParticipantsMap(map);
      }

      // Fetch Live Environmental & Weather Feed (OpenWeather)
      const destination = (tripDoc.exists() ? (tripDoc.data()?.destination || tripDoc.data()?.name) : '') || '';
      const firstCoords = loadedItems.find(i => i.location?.latitude && i.location?.longitude)?.location;

      if (destination || firstCoords) {
        setWeatherLoading(true);
        fetchLiveWeather(destination, firstCoords?.latitude ?? undefined, firstCoords?.longitude ?? undefined)
          .then(rep => {
            setWeatherReport(rep);
          })
          .catch(err => {
            console.warn('Live weather load error:', err);
          })
          .finally(() => {
            setWeatherLoading(false);
          });
      }
    } catch (err) {
      console.error('Error loading itinerary data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  async function handleRefreshWeather() {
    const dest = trip?.destination || trip?.name || '';
    const firstCoords = items.find(i => i.location?.latitude && i.location?.longitude)?.location;
    setWeatherLoading(true);
    try {
      const rep = await fetchLiveWeather(dest, firstCoords?.latitude ?? undefined, firstCoords?.longitude ?? undefined);
      setWeatherReport(rep);
    } catch (e) {
      console.warn('Weather refresh error:', e);
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowForm(false);
        setSwappingItem(null);
        setMovingDayItem(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate metrics
  const totalCost = useMemo(() => {
    return items
      .filter(i => i.status === 'active')
      .reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  }, [items]);

  const totalBudget = preferences?.total_budget || 0;
  const budgetPercent = totalBudget > 0 ? Math.min(Math.round((totalCost / totalBudget) * 100), 100) : 0;
  const isOverBudget = totalBudget > 0 && totalCost > totalBudget;

  const totalTravelMinutes = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.estimated_travel_time) {
        const match = item.estimated_travel_time.match(/(\d+)/);
        if (match) return sum + parseInt(match[1], 10);
      }
      return sum;
    }, 0);
  }, [items]);

  // Group items by day
  const groupedDays = useMemo(() => {
    if (days.length > 0) {
      return days.map(day => {
        const dayItems = items.filter(item => {
          if (item.itinerary_day_id) {
            return item.itinerary_day_id === day.id;
          }
          if (item.start_time) {
            return item.start_time.startsWith(day.day_date);
          }
          return false;
        });

        const filtered = categoryFilter === 'all'
          ? dayItems
          : dayItems.filter(item => item.type === categoryFilter);

        return {
          day,
          items: filtered,
        };
      });
    }

    const map: Record<string, ItineraryItem[]> = {};
    items.forEach(item => {
      const dateKey = item.start_time ? item.start_time.split('T')[0] : 'Unscheduled';
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    });

    return Object.entries(map).map(([dateStr, dayItems], idx) => ({
      day: {
        id: `mock-${idx}`,
        trip_id: tripId,
        day_date: dateStr,
        day_index: idx + 1,
        title: dateStr === 'Unscheduled' ? 'Flexible & Unscheduled' : `Day ${idx + 1}`,
        weather_forecast: null,
        created_at: '',
      } as ItineraryDayRecord,
      items: categoryFilter === 'all' ? dayItems : dayItems.filter(i => i.type === categoryFilter),
    }));
  }, [days, items, categoryFilter, tripId]);

  // Active items for Map (respects day selection)
  const mapItems = useMemo(() => {
    if (selectedDayFilter === 'all') {
      return items.filter(i => i.status === 'active');
    }
    const currentGroup = groupedDays.find(g => g.day.id === selectedDayFilter);
    return (currentGroup?.items || []).filter(i => i.status === 'active');
  }, [items, selectedDayFilter, groupedDays]);

  const activeDayTitle = useMemo(() => {
    if (selectedDayFilter === 'all') return 'Full Trip';
    const currentGroup = groupedDays.find(g => g.day.id === selectedDayFilter);
    return currentGroup?.day.title || `Day ${currentGroup?.day.day_index || 1}`;
  }, [selectedDayFilter, groupedDays]);

  // Format date helper
  function formatDayDate(dateStr: string) {
    if (!dateStr || dateStr === 'Unscheduled') return 'Flexible';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatTime(isoStr: string | null) {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  // RE-ORDERING & RECALCULATION
  async function handleMoveItem(dayId: string, itemIndex: number, direction: 'up' | 'down') {
    const targetGroup = groupedDays.find(g => g.day.id === dayId);
    if (!targetGroup) return;

    const dayItems = [...targetGroup.items];
    const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (newIndex < 0 || newIndex >= dayItems.length) return;

    const [moved] = dayItems.splice(itemIndex, 1);
    dayItems.splice(newIndex, 0, moved);

    const recalculated = recalculateDaySequence(dayItems);

    setItems(prev => {
      const map = new Map(recalculated.map(i => [i.id, i]));
      return prev.map(item => map.get(item.id) || item);
    });

    try {
      for (const item of recalculated) {
        await setDoc(doc(db, 'itinerary_items', item.id), {
          start_time: item.start_time,
          end_time: item.end_time,
          estimated_travel_time: item.estimated_travel_time,
          travel_distance_km: item.travel_distance_km,
          conflicts: item.conflicts,
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error saving reordered sequence:', err);
      loadData();
    }
  }

  // MOVE ACTIVITY TO ANOTHER DAY
  async function handleShiftDay(targetDayId: string) {
    if (!movingDayItem) return;

    const targetDay = days.find(d => d.id === targetDayId);
    if (!targetDay) return;

    try {
      let newStartTime = movingDayItem.start_time;
      let newEndTime = movingDayItem.end_time;

      if (movingDayItem.start_time) {
        const timePart = movingDayItem.start_time.split('T')[1] || '10:00:00Z';
        newStartTime = `${targetDay.day_date}T${timePart}`;
      }
      if (movingDayItem.end_time) {
        const timePart = movingDayItem.end_time.split('T')[1] || '12:00:00Z';
        newEndTime = `${targetDay.day_date}T${timePart}`;
      }

      await setDoc(doc(db, 'itinerary_items', movingDayItem.id), {
        itinerary_day_id: targetDay.id,
        start_time: newStartTime,
        end_time: newEndTime,
      }, { merge: true });

      setMovingDayItem(null);
      await loadData();
    } catch (err: any) {
      alert('Error moving activity: ' + (err?.message || 'Unknown error'));
    }
  }

  // SWAP ACTIVITY WITH AN ALTERNATIVE
  async function handleSwapActivity(alternative: typeof ALTERNATIVE_LOCATIONS[0]) {
    if (!swappingItem) return;

    try {
      await setDoc(doc(db, 'locations', alternative.id), {
        id: alternative.id,
        name: alternative.name,
        category: alternative.category,
        latitude: alternative.latitude,
        longitude: alternative.longitude,
        address: alternative.address,
        opening_hours: alternative.opening_hours,
        recommended_duration: alternative.recommended_duration,
        entry_fee: alternative.entry_fee,
        estimated_spending: alternative.estimated_spending,
        rating: alternative.rating,
        best_time_to_visit: alternative.best_time_to_visit,
      });

      await setDoc(doc(db, 'itinerary_items', swappingItem.id), {
        label: alternative.name,
        location_id: alternative.id,
        short_description: alternative.description,
        cost: alternative.entry_fee + alternative.estimated_spending,
      }, { merge: true });

      setSwappingItem(null);
      await loadData();
    } catch (err: any) {
      alert('Error swapping activity: ' + (err?.message || 'Unknown error'));
    }
  }

  // Form actions
  function openCreateModal(defaultDayId?: string, lat?: number, lng?: number) {
    setEditingId(null);
    setFormType('activity');
    setFormLabel('');
    setFormStartTime('');
    setFormEndTime('');
    setFormCost('');
    setFormSplitType('equal');
    setFormDescription('');
    setFormLocationName(trip?.destination || '');
    setFormAddress('');
    setFormLatitude(lat !== undefined ? lat.toFixed(6) : '');
    setFormLongitude(lng !== undefined ? lng.toFixed(6) : '');
    setFormSelectedMembers(members.map(m => m.id));
    setFormDayId(defaultDayId || (days[0]?.id || ''));
    setShowAdvanced(false);
    setShowForm(true);
  }

  function openEditModal(item: ItineraryItem) {
    setEditingId(item.id);
    setFormType(item.type);
    setFormLabel(item.label);
    setFormStartTime(item.start_time ? item.start_time.slice(0, 16) : '');
    setFormEndTime(item.end_time ? item.end_time.slice(0, 16) : '');
    setFormCost(item.cost?.toString() || '');
    setFormSplitType(item.default_split_type);
    setFormDescription(item.short_description || '');
    setFormLocationName(item.location?.name || '');
    setFormAddress(item.location?.address || '');
    setFormLatitude(item.location?.latitude?.toString() || '');
    setFormLongitude(item.location?.longitude?.toString() || '');
    setFormSelectedMembers((participantsMap[item.id] || []).map(p => p.member_id));
    setFormDayId(item.itinerary_day_id || '');
    setShowAdvanced(!!(item.short_description || (participantsMap[item.id] && participantsMap[item.id].length > 0)));
    setShowForm(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Strictly enforce DB check constraint: ('flight','hotel','activity','transfer','dining','other')
      const ALLOWED_ITEM_TYPES: ItemType[] = ['flight', 'hotel', 'activity', 'transfer', 'dining', 'other'];
      let sanitizedType: ItemType = 'activity';
      if (ALLOWED_ITEM_TYPES.includes(formType as ItemType)) {
        sanitizedType = formType as ItemType;
      } else if ((formType as string) === 'attraction') {
        sanitizedType = 'activity';
      } else if ((formType as string) === 'restaurant') {
        sanitizedType = 'dining';
      } else if ((formType as string) === 'transit') {
        sanitizedType = 'transfer';
      }

      let locationId: string | null = null;
      let finalLat: number | null = formLatitude ? parseFloat(formLatitude) : null;
      let finalLng: number | null = formLongitude ? parseFloat(formLongitude) : null;

      // Automatically geocode location or label if coordinates are not manually entered
      if ((finalLat === null || finalLng === null || isNaN(finalLat) || isNaN(finalLng)) && (formLocationName.trim() || formLabel.trim())) {
        const queryToGeocode = formLocationName.trim() || formLabel.trim();
        const geoRes = await geocodeLocation(queryToGeocode, trip?.destination);
        if (geoRes) {
          finalLat = geoRes.lat;
          finalLng = geoRes.lng;
        }
      }

      // If location information / coordinates are provided, upsert into locations table
      if (formLocationName.trim() || (finalLat !== null && finalLng !== null)) {
        const locId = crypto.randomUUID();
        const locCategory = 
          sanitizedType === 'dining' ? 'restaurant' : 
          sanitizedType === 'transfer' ? 'transit' : 
          sanitizedType === 'hotel' ? 'hotel' : 'attraction';

        const { error: locErr } = await setDoc(doc(db, 'locations', locId), {
          id: locId,
          name: formLocationName.trim() || formLabel.trim(),
          category: locCategory,
          address: formAddress.trim() || null,
          latitude: finalLat,
          longitude: finalLng,
        }, { merge: true })
        .then(() => ({ error: null }))
        .catch(err => ({ error: err }));

        if (!locErr) {
          locationId = locId;
        }
      }

      const payload: any = {
        trip_id: tripId,
        type: sanitizedType,
        label: formLabel,
        start_time: formStartTime ? new Date(formStartTime).toISOString() : null,
        end_time: formEndTime ? new Date(formEndTime).toISOString() : null,
        cost: parseFloat(formCost) || 0,
        default_split_type: formSplitType,
        short_description: formDescription || null,
        itinerary_day_id: formDayId || null,
      };

      if (locationId) {
        payload.location_id = locationId;
      }

      let itemId = editingId;

      if (editingId) {
        await setDoc(doc(db, 'itinerary_items', editingId), payload, { merge: true });
      } else {
        const newRef = doc(collection(db, 'itinerary_items'));
        itemId = newRef.id;
        await setDoc(newRef, { id: itemId, ...payload });
      }

      if (itemId) {
        const partsQ = query(collection(db, 'item_participants'), where('item_id', '==', itemId));
        const partsRes = await getDocs(partsQ);
        for (const p of partsRes.docs) {
          await deleteDoc(p.ref);
        }
        
        if (formSelectedMembers.length > 0) {
          const promises = formSelectedMembers.map(memberId => {
            const pRef = doc(collection(db, 'item_participants'));
            return setDoc(pRef, {
              id: pRef.id,
              item_id: itemId!,
              member_id: memberId,
            });
          });
          await Promise.all(promises);
        }

        // Emit immutable ledger event for booking
        if (!editingId) {
          appendEvent(
            tripId,
            'BOOKING_CREATED',
            members[0]?.id || 'organizer',
            {
              itemId,
              type: formType,
              label: formLabel.trim(),
              cost: formCost ? Number(formCost) : 0,
              currency: 'INR',
              defaultSplitType: formSplitType,
              participantMemberIds: formSelectedMembers.length > 0 ? formSelectedMembers : members.map(m => m.id),
              startTime: formStartTime || null,
              endTime: formEndTime || null,
              vendorName: null,
              cancellationPolicy: null,
            }
          ).catch(e => console.warn('Ledger event error:', e));
        } else {
          appendEvent(
            tripId,
            'BOOKING_UPDATED',
            members[0]?.id || 'organizer',
            {
              itemId,
              changes: {
                label: formLabel.trim(),
                cost: formCost ? Number(formCost) : 0,
                startTime: formStartTime || undefined,
                endTime: formEndTime || undefined,
                defaultSplitType: formSplitType,
              },
              previousValues: {},
            }
          ).catch(e => console.warn('Ledger event error:', e));
        }
      }

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      alert('Error saving activity: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: ItineraryItem) {
    const newStatus = item.status === 'active' ? 'cancelled' : 'active';
    await setDoc(doc(db, 'itinerary_items', item.id), { status: newStatus }, { merge: true });
    if (newStatus === 'cancelled') {
      appendEvent(
        tripId,
        'BOOKING_CANCELLED',
        members[0]?.id || 'organizer',
        {
          itemId: item.id,
          label: item.label,
          reason: 'Cancelled from itinerary',
          refundAmount: null,
          penaltyAmount: null,
          cancelledBy: members[0]?.id || 'organizer',
        }
      ).catch(e => console.warn('Ledger event error:', e));
    }
    loadData();
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Are you sure you want to remove this activity?')) return;
    appendEvent(
      tripId,
      'BOOKING_CANCELLED',
      members[0]?.id || 'organizer',
      {
        itemId: id,
        label: 'Deleted Activity',
        reason: 'Deleted from itinerary',
        refundAmount: null,
        penaltyAmount: null,
        cancelledBy: members[0]?.id || 'organizer',
      }
    ).catch(e => console.warn('Ledger event error:', e));
    await deleteDoc(doc(db, 'itinerary_items', id));
    loadData();
  }

  async function handleClearAllActivities() {
    if (!confirm('Are you sure you want to remove all activities from this itinerary?')) return;
    try {
      const q = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      loadData();
    } catch (err) {
      console.error('Error clearing activities:', err);
    }
  }

  // Remove all dummy / auto-generated sample activities
  async function handlePurgeSampleActivities() {
    const sampleItems = items.filter(i => isSampleActivity(i.label));
    if (sampleItems.length === 0) {
      alert('No sample template activities found.');
      return;
    }
    if (!confirm(`Remove ${sampleItems.length} auto-generated sample activities (e.g. Breakfast, Dinner, Fort, etc.)? Your custom activities will be preserved.`)) return;
    setLoading(true);
    try {
      for (const item of sampleItems) {
        await deleteDoc(doc(db, 'itinerary_items', item.id));
      }
      await loadData();
    } catch (err: any) {
      alert('Error removing dummy activities: ' + (err?.message || 'Unknown error'));
      setLoading(false);
    }
  }

  const sampleActivities = useMemo(() => {
    return items.filter(i => isSampleActivity(i.label));
  }, [items]);

  function toggleMember(id: string) {
    setFormSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Loading your travel itinerary...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      className="space-y-6 pb-24 font-['Inter']"
    >
      {/* ── TOP DASHBOARD OVERVIEW ── */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 p-8 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Compass className="w-3.5 h-3.5" />
                {preferences?.travel_style || 'Balanced'} Pace
              </span>
              {trip?.destination && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {trip.destination}
                </span>
              )}
              {days.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Calendar className="w-3.5 h-3.5" />
                  {days.length} Days Planned
                </span>
              )}
              {weatherReport ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
                  {weatherReport.current.condition.toLowerCase().includes('rain') ? (
                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                  ) : weatherReport.current.condition === 'Clear' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{weatherReport.current.temp}°C {weatherReport.current.condition}</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase">● Live OpenWeather</span>
                </span>
              ) : weatherLoading ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50/70 text-amber-800 border border-amber-200/60 shadow-2xs animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connecting OpenWeather...</span>
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {trip?.name || 'Trip Itinerary'}
            </h1>

            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {trip?.start_date && trip?.end_date
                ? `${formatDayDate(trip.start_date)} – ${formatDayDate(trip.end_date)}`
                : 'Dates to be finalized'}
              {members.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{members.length} {members.length === 1 ? 'Traveler' : 'Travelers'}</span>
                </>
              )}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewLayout('split')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewLayout === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Split Timeline & Route Map"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                onClick={() => setViewLayout('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewLayout === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Timeline Only"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
              <button
                onClick={() => setViewLayout('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewLayout === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Map Only"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>

            {/* Purge Dummy / Sample Activities */}
            {sampleActivities.length > 0 && (
              <button
                onClick={handlePurgeSampleActivities}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors shadow-xs"
                title="Remove auto-generated sample activities (Breakfast, Dinner, Fort, etc.)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Remove Sample Data ({sampleActivities.length})</span>
              </button>
            )}

            {/* Clear All Activities */}
            {items.length > 0 && (
              <button
                onClick={handleClearAllActivities}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 bg-white border border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 transition-colors shadow-xs"
                title="Remove all activities to start with an empty itinerary"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            {/* Add Activity */}
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{ backgroundColor: COLORS.burgundy }}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Activity</span>
            </button>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200/60">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Budget Used</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
                ₹{totalCost.toLocaleString('en-IN')}
              </span>
              {totalBudget > 0 && (
                <span className="text-xs text-slate-400 font-medium">/ ₹{totalBudget.toLocaleString('en-IN')}</span>
              )}
            </div>
            {totalBudget > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activities</span>
            <div className="text-lg font-bold text-slate-900">
              {items.filter(i => i.status === 'active').length}
              <span className="text-xs text-slate-400 font-normal ml-1.5">scheduled</span>
            </div>
            <p className="text-xs text-slate-500">
              {days.length > 0 ? `~${(items.length / days.length).toFixed(1)} per day` : 'No days yet'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Transit Time</span>
            <div className="text-lg font-bold text-slate-900">
              {totalTravelMinutes > 0 ? (
                <>
                  {Math.floor(totalTravelMinutes / 60) > 0 && `${Math.floor(totalTravelMinutes / 60)}h `}
                  {totalTravelMinutes % 60}m
                </>
              ) : (
                '0 mins'
              )}
            </div>
            <p className="text-xs text-slate-500">Route buffers included</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Interests</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(preferences?.interests && preferences.interests.length > 0) ? (
                preferences.interests.slice(0, 2).map((interest, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    {interest}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">General exploring</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── LIVE WEATHER & ENVIRONMENTAL DIGITAL TWIN (OPENWEATHER) ── */}
      {weatherReport ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/20 to-sky-50/25 p-6 shadow-xl backdrop-blur-md"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md text-white shrink-0" style={{ backgroundColor: COLORS.burgundy }}>
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Environmental Digital Twin • Live Weather Stream
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {weatherReport.source === 'OpenWeather'
                      ? 'OpenWeather Live Connected (80e015...)'
                      : 'Live Meteorological Stream (OpenWeather Key: 80e015... Active)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="font-semibold text-slate-700">{weatherReport.destination}</span>
                  {weatherReport.current.coord && (
                    <span className="text-slate-400">
                      ({weatherReport.current.coord.lat.toFixed(2)}°N, {weatherReport.current.coord.lon.toFixed(2)}°E)
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span>Updated {new Date(weatherReport.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshWeather}
                disabled={weatherLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:text-indigo-600 hover:border-indigo-200 transition shadow-2xs cursor-pointer"
                title="Refresh live weather feed from OpenWeather"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{weatherLoading ? 'Updating...' : 'Sync Weather'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWeatherDetails(!showWeatherDetails)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title={showWeatherDetails ? 'Collapse weather panel' : 'Expand weather panel'}
              >
                {showWeatherDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded Content */}
          {showWeatherDetails && (
            <div className="mt-5 space-y-5">
              {/* Top Row: Current Metrics & AI Impact Assessment */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Current Atmospheric State */}
                <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Conditions</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                          {weatherReport.current.temp}°C
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          Feels {weatherReport.current.feels_like}°C
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 capitalize mt-1 flex items-center gap-1.5">
                        {weatherReport.current.condition === 'Clear' ? (
                          <Sun className="w-4 h-4 text-amber-500" />
                        ) : weatherReport.current.condition.toLowerCase().includes('rain') ? (
                          <CloudRain className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Cloud className="w-4 h-4 text-slate-500" />
                        )}
                        <span>{weatherReport.current.description}</span>
                      </p>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                      <div>High: <span className="font-bold text-slate-800">{weatherReport.current.temp_max}°C</span></div>
                      <div>Low: <span className="font-bold text-slate-800">{weatherReport.current.temp_min}°C</span></div>
                    </div>
                  </div>

                  {/* 4 Sensor Gauges */}
                  <div className="grid grid-cols-4 gap-2 pt-4 mt-4 border-t border-slate-100 text-center">
                    <div className="p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center justify-center text-sky-500 mb-0.5">
                        <Droplets className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Humidity</span>
                      <div className="text-xs font-bold text-slate-800">{weatherReport.current.humidity}%</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center justify-center text-teal-500 mb-0.5">
                        <Wind className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Wind</span>
                      <div className="text-xs font-bold text-slate-800">{weatherReport.current.wind_speed} km/h</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center justify-center text-indigo-500 mb-0.5">
                        <CloudRain className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Rain 1h</span>
                      <div className="text-xs font-bold text-slate-800">{weatherReport.current.rain_1h} mm</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50">
                      <div className="flex items-center justify-center text-amber-500 mb-0.5">
                        <Thermometer className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Pressure</span>
                      <div className="text-xs font-bold text-slate-800">{weatherReport.current.pressure} hPa</div>
                    </div>
                  </div>
                </div>

                {/* AI Digital Twin Impact Model */}
                <div className="lg:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Digital Twin Assessment</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        AI Cascade Engine
                      </span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      weatherReport.impact_assessment.risk_level === 'severe'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : weatherReport.impact_assessment.risk_level === 'high'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : weatherReport.impact_assessment.risk_level === 'moderate'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {weatherReport.impact_assessment.risk_level === 'low' ? '✅' : '⚠️'}
                      {weatherReport.impact_assessment.risk_level} Disruption Risk
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {weatherReport.impact_assessment.impact_summary}
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Operational Responses:</span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                      {weatherReport.impact_assessment.recommended_actions.slice(0, 4).map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 5-Day Forecast Row */}
              {weatherReport.forecast.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    5-Day Weather Forecast & Itinerary Synchronization
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {weatherReport.forecast.slice(0, 5).map((f) => (
                      <div
                        key={f.date}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{f.day_name}</span>
                          <span className="text-[10px] font-medium text-slate-400">{formatDayDate(f.date)}</span>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-1.5">
                            {f.condition.toLowerCase().includes('rain') ? (
                              <CloudRain className="w-5 h-5 text-blue-500" />
                            ) : f.condition === 'Clear' ? (
                              <Sun className="w-5 h-5 text-amber-500" />
                            ) : (
                              <Cloud className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="text-xs font-bold text-slate-700">{f.condition}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900">{f.temp_max}°</span>
                            <span className="text-[10px] text-slate-400 ml-1">{f.temp_min}°</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Droplets className="w-2.5 h-2.5 text-sky-500" />
                            {Math.round(f.pop * 100)}% rain
                          </span>
                          <span className="flex items-center gap-1">
                            <Wind className="w-2.5 h-2.5 text-slate-400" />
                            {f.wind_speed} km/h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ) : weatherLoading ? (
        <div className="rounded-[2rem] border border-indigo-100/80 bg-white/80 p-6 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600 animate-pulse">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">Streaming Live OpenWeather Data...</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">Contacting OpenWeather API for {trip?.destination || trip?.name || 'trip destination'}...</p>
            </div>
          </div>
          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
        </div>
      ) : null}

      {/* ── DUMMY DATA PURGE BANNER ── */}
      {sampleActivities.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 text-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950">
                Found {sampleActivities.length} auto-generated sample activities
              </div>
              <div className="text-[11px] text-amber-800/80 mt-0.5">
                Template items (&ldquo;{sampleActivities.slice(0, 3).map(s => s.label).join('”, “')}&rdquo;) can be removed in one click. Your custom plans like &ldquo;{items.find(i => !isSampleActivity(i.label))?.label || 'your custom activities'}&rdquo; will be preserved.
              </div>
            </div>
          </div>
          <button
            onClick={handlePurgeSampleActivities}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition shadow-xs self-start sm:self-auto flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Dummy Data ({sampleActivities.length})</span>
          </button>
        </div>
      )}

      {/* ── DAY SELECTOR & CATEGORY FILTERS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedDayFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Days ({items.length})
          </button>

          {groupedDays.map(({ day, items: dItems }) => {
            const dForecast = weatherReport?.forecast.find(f => f.date === day.day_date) || 
              (weatherReport?.forecast.length ? weatherReport.forecast[(day.day_index ? day.day_index - 1 : 0) % weatherReport.forecast.length] : null);

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDayFilter(day.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedDayFilter === day.id
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{day.day_index ? `Day ${day.day_index}` : 'Day'}</span>
                {dForecast && (
                  <span className="text-[10px] opacity-90">
                    {dForecast.condition === 'Clear' ? '☀️' : dForecast.condition.toLowerCase().includes('rain') ? '🌧️' : '⛅'}
                    {dForecast.temp_max}°
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedDayFilter === day.id ? 'bg-indigo-700/60 text-indigo-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {dItems.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto overflow-x-auto">
          {['all', 'activity', 'dining', 'hotel', 'transfer'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                categoryFilter === cat
                  ? 'bg-slate-200/80 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Types' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (SPLIT OR TIMELINE/MAP) ── */}
      <div className={`grid gap-6 ${
        viewLayout === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
      }`}>
        {/* TIMELINE COLUMN */}
        {viewLayout !== 'map' && (
          <div className={viewLayout === 'split' ? 'lg:col-span-7 xl:col-span-7 space-y-10' : 'space-y-10'}>
            {groupedDays.length === 0 || items.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white border border-dashed border-slate-200 rounded-2xl space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <Compass className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-900">Your itinerary is empty</h3>
                  <p className="text-sm text-slate-500">
                    Start by adding your first activity or place to the map.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => openCreateModal()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Activity & Map Pin</span>
                  </button>
                </div>
              </div>
            ) : (
              groupedDays
                .filter(({ day }) => selectedDayFilter === 'all' || selectedDayFilter === day.id)
                .map(({ day, items: dayItems }) => {
                  const dayCost = dayItems
                    .filter(i => i.status === 'active')
                    .reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

                  const dayForecast = weatherReport?.forecast.find(f => f.date === day.day_date) || 
                    (weatherReport?.forecast.length ? weatherReport.forecast[(day.day_index ? day.day_index - 1 : 0) % weatherReport.forecast.length] : null);

                  return (
                    <motion.div 
                      key={day.id} 
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className="space-y-4"
                    >
                      {/* Day Header Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white font-bold flex-shrink-0 shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Day</span>
                            <span className="text-base leading-none">{day.day_index || 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-bold text-slate-900">
                                {day.title || `Day ${day.day_index}`}
                              </h2>
                              {dayForecast ? (
                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-indigo-50/70 text-indigo-700 font-semibold border border-indigo-100">
                                  {dayForecast.condition.toLowerCase().includes('rain') ? (
                                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                                  ) : dayForecast.condition === 'Clear' ? (
                                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <Cloud className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span>{dayForecast.condition} • {dayForecast.temp_max}°/{dayForecast.temp_min}°C</span>
                                  {dayForecast.pop > 0.2 && (
                                    <span className="text-[10px] text-blue-600 font-bold ml-0.5">({Math.round(dayForecast.pop * 100)}% rain)</span>
                                  )}
                                </span>
                              ) : day.weather_forecast?.condition ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium">
                                  <Sun className="w-3 h-3 text-amber-500" />
                                  {day.weather_forecast.condition} • {day.weather_forecast.temp}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatDayDate(day.day_date)} • {dayItems.length} activities • ₹{dayCost.toLocaleString('en-IN')} est.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => openCreateModal(day.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 transition-colors self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add to this day
                        </button>
                      </div>

                      {/* Vertical Timeline Items */}
                      {dayItems.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                          No activities match the filter for this day.
                        </div>
                      ) : (
                        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                          {dayItems.map((item, idx) => {
                            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
                            const IconComponent = cfg.icon;
                            const isCancelled = item.status === 'cancelled';
                            const participants = participantsMap[item.id] || [];
                            const conflicts = (item.conflicts && Array.isArray(item.conflicts)) ? item.conflicts : [];
                            const isHighlighted = highlightedItemId === item.id;

                            return (
                              <div
                                key={item.id}
                                id={`itin-item-${item.id}`}
                                className="relative group scroll-mt-20"
                                onMouseEnter={() => setHighlightedItemId(item.id)}
                                onMouseLeave={() => setHighlightedItemId(null)}
                              >
                                {/* Timeline Node Point */}
                                <div
                                  className={`absolute -left-6 sm:-left-8 top-4 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center transition-transform group-hover:scale-125 ${
                                    isCancelled ? 'bg-slate-300' : isHighlighted ? 'bg-amber-500 ring-4 ring-amber-200' : 'bg-indigo-600'
                                  }`}
                                />

                                {/* Activity Card */}
                                <motion.div
                                  whileHover={{ x: 4 }}
                                  className={`rounded-2xl border p-5 transition-all duration-300 bg-white ${
                                    isCancelled
                                      ? 'opacity-60 border-slate-200 bg-slate-50/50'
                                      : isHighlighted
                                      ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-100 scale-[1.02]'
                                      : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-lg'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      {/* Order Move Arrows */}
                                      <div className="flex flex-col gap-0.5 pt-1">
                                        <button
                                          onClick={() => handleMoveItem(day.id, idx, 'up')}
                                          disabled={idx === 0}
                                          className="p-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                          title="Move earlier"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleMoveItem(day.id, idx, 'down')}
                                          disabled={idx === dayItems.length - 1}
                                          className="p-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                          title="Move later"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Category Icon Badge */}
                                      <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{
                                          backgroundColor: cfg.bg,
                                          color: cfg.color,
                                          border: `1px solid ${cfg.border}`,
                                        }}
                                      >
                                        <IconComponent className="w-5 h-5" />
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                                          >
                                            {cfg.label}
                                          </span>

                                          {/* Time Slot Pill */}
                                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {formatTime(item.start_time)} – {formatTime(item.end_time)}
                                          </span>

                                          {isCancelled && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                                              Cancelled
                                            </span>
                                          )}
                                        </div>

                                        <h3 className={`text-base font-bold text-slate-900 ${isCancelled ? 'line-through text-slate-500' : ''}`}>
                                          {item.label}
                                        </h3>

                                        {item.short_description && (
                                          <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                                            {item.short_description}
                                          </p>
                                        )}

                                        {item.location && (
                                          <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
                                            {item.location.address && (
                                              <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-slate-400" />
                                                {item.location.address}
                                              </span>
                                            )}
                                            {item.location.rating && (
                                              <span className="text-amber-600 font-medium">
                                                ★ {item.location.rating}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Right Side: Cost & Actions */}
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-slate-900">
                                          {item.cost && item.cost > 0 ? `₹${item.cost.toLocaleString('en-IN')}` : 'Free'}
                                        </div>
                                        <div className="text-[10px] text-slate-400 capitalize">
                                          {item.default_split_type.replace(/_/g, ' ')}
                                        </div>
                                      </div>

                                      {/* Quick Action Buttons */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setSwappingItem(item)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                          title="Find alternative places / swap"
                                        >
                                          <Sparkles className="w-4 h-4 text-amber-500" />
                                        </button>
                                        <button
                                          onClick={() => setMovingDayItem(item)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                          title="Shift to another day"
                                        >
                                          <CalendarDays className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => openEditModal(item)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                          title="Edit activity"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleToggleStatus(item)}
                                          className={`p-1.5 rounded-lg transition-colors ${
                                            isCancelled
                                              ? 'text-emerald-600 hover:bg-emerald-50'
                                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                          }`}
                                          title={isCancelled ? 'Reactivate activity' : 'Cancel activity'}
                                        >
                                          {isCancelled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                        </button>
                                        <button
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                          title="Delete activity"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Conflict Alerts */}
                                  {conflicts.length > 0 && (
                                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2">
                                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div className="space-y-0.5">
                                        {conflicts.map((conf: any, cIdx: number) => (
                                          <p key={cIdx} className="font-medium">
                                            {typeof conf === 'string' ? conf : conf.message || JSON.stringify(conf)}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Participants footer if any */}
                                  {participants.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                      <div className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-medium text-slate-600">Split between:</span>
                                        <div className="flex flex-wrap gap-1">
                                          {participants.map(p => {
                                            const mem = members.find(m => m.id === p.member_id);
                                            return (
                                              <span
                                                key={p.member_id}
                                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                                              >
                                                {mem?.display_name || 'Member'}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </motion.div>

                                {/* Travel Buffer between this and next activity */}
                                {idx < dayItems.length - 1 && (
                                  <div className="py-2 pl-3 flex items-center gap-2 text-xs text-slate-500">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/60 font-medium">
                                      <Navigation className="w-3 h-3 text-slate-400" />
                                      <span>
                                        {dayItems[idx + 1].estimated_travel_time || '~15 min travel buffer'}
                                      </span>
                                      {dayItems[idx + 1].travel_distance_km && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <span>{dayItems[idx + 1].travel_distance_km} km</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })
            )}
          </div>
        )}

        {/* MAP COLUMN (Sticky on Desktop) */}
        {viewLayout !== 'timeline' && (
          <div className={viewLayout === 'split' ? 'lg:col-span-5 xl:col-span-5' : 'w-full'}>
            <div
              className="sticky top-20 space-y-3 overscroll-contain"
              data-lenis-prevent
              data-lenis-prevent-wheel
              data-lenis-prevent-touch
            >
              <ItineraryMap
                items={mapItems}
                destination={trip?.destination}
                highlightedItemId={highlightedItemId}
                dayTitle={activeDayTitle}
                weatherReport={weatherReport}
                socialSignals={socialSignals}
                onAddLocationClick={() => openCreateModal()}
                onMapClick={(lat, lng) => {
                  openCreateModal(undefined, lat, lng);
                  setFormLocationName(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                }}
                onMarkerClick={(itemId) => {
                  setHighlightedItemId(itemId);
                  const el = document.getElementById(`itin-item-${itemId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Weather Twin & Social Signals ({socialSignals.length} Active)</span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/trip/${tripId}/weather`)}
                  className="font-bold text-rose-700 hover:text-rose-800 transition flex items-center gap-1"
                >
                  Full Weather Twin &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── SWAP / ALTERNATIVES MODAL ── */}
      <AnimatePresence>
        {swappingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              onClick={() => setSwappingItem(null)}
            />
            <motion.div 
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-[2rem] shadow-2xl border flex flex-col z-10 overflow-hidden"
              style={{ borderColor: COLORS.cream }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b bg-white shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.rose }}>Quick Replace</span>
                  <h2 className="text-xl font-black tracking-tight" style={{ color: COLORS.burgundy }}>
                    Alternative Places for &ldquo;{swappingItem.label}&rdquo;
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSwappingItem(null)}
                  className="p-2 rounded-xl hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain" data-lenis-prevent>
                <p className="text-xs text-gray-500 font-medium">
                  Select an alternative recommendation below. The itinerary will automatically replace this activity, recompute travel buffers, and update the route line.
                </p>

                <div className="space-y-3">
                  {ALTERNATIVE_LOCATIONS.map(alt => (
                    <div
                      key={alt.id}
                      className="p-4 rounded-2xl border hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                      style={{ borderColor: `${COLORS.cream}` }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold capitalize px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: `${COLORS.burgundy}10`, color: COLORS.burgundy }}>
                            {alt.category}
                          </span>
                          <span className="text-xs font-bold text-amber-600">
                            ★ {alt.rating}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-[#791523] transition-colors">
                          {alt.name}
                        </h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {alt.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 pt-1">
                          <span>📍 {alt.address}</span>
                          <span>⏱️ {alt.recommended_duration}</span>
                          <span>💵 {alt.entry_fee > 0 ? `₹${alt.entry_fee} entry` : 'Free'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSwapActivity(alt)}
                        className="self-end px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs hover:scale-[1.02] active:scale-95 cursor-pointer"
                        style={{ backgroundColor: COLORS.burgundy }}
                      >
                        Swap with this place
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 px-6 border-t bg-gray-50/80 flex justify-end shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
                <button
                  type="button"
                  onClick={() => setSwappingItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SHIFT DAY MODAL ── */}
      <AnimatePresence>
        {movingDayItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              onClick={() => setMovingDayItem(null)}
            />
            <motion.div 
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full max-w-sm max-h-[85vh] bg-white rounded-[2rem] shadow-2xl border flex flex-col z-10 overflow-hidden"
              style={{ borderColor: COLORS.cream }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b bg-white shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
                <h2 className="text-lg font-black tracking-tight" style={{ color: COLORS.burgundy }}>
                  Move to Another Day
                </h2>
                <button
                  type="button"
                  onClick={() => setMovingDayItem(null)}
                  className="p-2 rounded-xl hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-3 flex-1 overscroll-contain" data-lenis-prevent>
                <p className="text-xs text-gray-500 font-medium">
                  Choose which day you want to shift &ldquo;{movingDayItem.label}&rdquo; to:
                </p>

                <div className="space-y-2">
                  {days.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleShiftDay(d.id)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border hover:border-[#791523] hover:bg-[#791523]/5 text-left text-xs font-bold text-gray-800 transition-all cursor-pointer"
                      style={{ borderColor: `${COLORS.cream}` }}
                    >
                      <span>Day {d.day_index} — {formatDayDate(d.day_date)}</span>
                      <span className="font-bold" style={{ color: COLORS.burgundy }}>Select &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 px-6 border-t bg-gray-50/80 flex justify-end shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
                <button
                  type="button"
                  onClick={() => setMovingDayItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RIGHT-SIDE SLIDE DRAWER FOR CREATE / EDIT ACTIVITY ── */}
      <AnimatePresence>
        {showForm && (
          <>
            {/* Transparent backdrop to close on outside click without darkening the window */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/[0.05] cursor-pointer"
              onClick={() => setShowForm(false)}
            />

            {/* Right Slide-in Panel */}
            <motion.div 
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              data-lenis-prevent
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[400px] max-w-full bg-white shadow-[-16px_0_40px_rgba(0,0,0,0.15)] border-l flex flex-col overflow-hidden"
              style={{ borderColor: COLORS.cream }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Always visible at top */}
              <div className="flex items-center justify-between px-5 py-4 border-b bg-white shrink-0 z-10" style={{ borderColor: `${COLORS.cream}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs text-white" style={{ backgroundColor: COLORS.burgundy }}>
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight" style={{ color: COLORS.burgundy }}>
                      {editingId ? 'Edit Activity' : 'Add Activity'}
                    </h2>
                    <span className="text-[11px] text-gray-400 font-medium">Itinerary Schedule & Map</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body - Clean, Smooth & Scrollable */}
              <form onSubmit={handleSaveItem} className="flex-1 flex flex-col min-h-0 overflow-hidden" data-lenis-prevent>
                <div 
                  className="overflow-y-auto px-5 py-4 space-y-3.5 flex-1 overscroll-contain touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  data-lenis-prevent
                >
                  
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sea Fort Visit, Seafood Dinner..."
                      value={formLabel}
                      onChange={e => setFormLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs outline-none font-medium transition-all"
                      style={{ borderColor: `${COLORS.cream}` }}
                      onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                      onBlur={e => e.target.style.borderColor = COLORS.cream}
                    />
                  </div>

                  {/* Day & Category in 1 row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Day</label>
                      <select
                        value={formDayId}
                        onChange={e => setFormDayId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none font-medium bg-white cursor-pointer"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      >
                        <option value="">Flexible / Unscheduled</option>
                        {days.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.day_index ? `Day ${d.day_index}` : 'Day'} ({formatDayDate(d.day_date)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Category</label>
                      <select
                        value={formType}
                        onChange={e => setFormType(e.target.value as ItemType)}
                        className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none font-medium bg-white cursor-pointer"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      >
                        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Location & Map Pin - Compact Inline Row */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Location / Map Pin</label>
                      {formLatitude && formLongitude ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Pin set</span>
                          <button
                            type="button"
                            onClick={() => { setFormLatitude(''); setFormLongitude(''); }}
                            className="text-gray-400 hover:text-red-500 ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Place name or address..."
                        value={formLocationName}
                        onChange={e => setFormLocationName(e.target.value)}
                        className="w-full pl-3 pr-20 py-2 rounded-xl border text-xs outline-none font-medium transition-all"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!formLocationName.trim() && !formLabel.trim()) return;
                          setGeocodingLoc(true);
                          const res = await geocodeLocation(formLocationName || formLabel, trip?.destination);
                          setGeocodingLoc(false);
                          if (res) {
                            setFormLatitude(res.lat.toFixed(6));
                            setFormLongitude(res.lng.toFixed(6));
                          } else {
                            alert('Location not found automatically. You can click on the map to place a pin.');
                          }
                        }}
                        className="absolute right-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        style={{ backgroundColor: COLORS.rose }}
                        title="Auto-find coordinates"
                      >
                        {geocodingLoc ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Navigation className="w-2.5 h-2.5" />}
                        <span>Pin</span>
                      </button>
                    </div>
                  </div>

                  {/* Timing in 1 row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Start Time</label>
                      <input
                        type="datetime-local"
                        value={formStartTime}
                        onChange={e => setFormStartTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none font-medium"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">End Time</label>
                      <input
                        type="datetime-local"
                        value={formEndTime}
                        onChange={e => setFormEndTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none font-medium"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      />
                    </div>
                  </div>

                  {/* Cost & Split in 1 row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Cost (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0 (Free)"
                        value={formCost}
                        onChange={e => setFormCost(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none font-medium"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Split</label>
                      <select
                        value={formSplitType}
                        onChange={e => setFormSplitType(e.target.value as SplitType)}
                        className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none font-medium bg-white cursor-pointer"
                        style={{ borderColor: `${COLORS.cream}` }}
                        onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                        onBlur={e => e.target.style.borderColor = COLORS.cream}
                      >
                        {SPLIT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Toggle for Additional Details (Notes & Split Members) */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      style={{ color: COLORS.burgundy }}
                    >
                      <span>{showAdvanced ? '− Hide notes & members' : '+ Add notes & specific travelers'}</span>
                    </button>
                  </div>

                  {/* Collapsible Section */}
                  {showAdvanced && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      className="space-y-3 pt-1 border-t" 
                      style={{ borderColor: `${COLORS.cream}` }}
                    >
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Description / Notes</label>
                        <textarea
                          rows={2}
                          placeholder="Booking reference, tickets, or reminder notes..."
                          value={formDescription}
                          onChange={e => setFormDescription(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none font-medium"
                          style={{ borderColor: `${COLORS.cream}` }}
                          onFocus={e => e.target.style.borderColor = COLORS.burgundy}
                          onBlur={e => e.target.style.borderColor = COLORS.cream}
                        />
                      </div>

                      {members.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Travelers Split</label>
                          <div className="flex flex-wrap gap-1.5">
                            {members.map(m => {
                              const selected = formSelectedMembers.includes(m.id);
                              return (
                                <button
                                  type="button"
                                  key={m.id}
                                  onClick={() => toggleMember(m.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                    selected ? 'text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-50'
                                  }`}
                                  style={selected ? { backgroundColor: COLORS.burgundy, borderColor: COLORS.burgundy } : { borderColor: COLORS.cream }}
                                >
                                  {m.display_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Footer - Always visible & pinned to bottom */}
                <div className="sticky bottom-0 z-20 flex items-center justify-between px-5 py-3.5 border-t bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                    style={{ backgroundColor: COLORS.burgundy }}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>{saving ? 'Saving...' : editingId ? 'Update' : 'Add Activity'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
