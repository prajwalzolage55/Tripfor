'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
import { recalculateDaySequence, ALTERNATIVE_LOCATIONS } from '@/lib/itinerary-recalculate';
import ItineraryMap from '@/components/ItineraryMap';
import {
  Plus, Plane, Hotel, Activity, Car, UtensilsCrossed, MoreHorizontal,
  Calendar, DollarSign, Users, X, Trash2, Edit3, Check, Ban, Loader2,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Sparkles, Navigation,
  Compass, MapPin, RefreshCw, Sun, CloudRain, ShieldAlert,
  ArrowUp, ArrowDown, Map as MapIcon, Columns, CalendarDays, CheckCircle2,
  Copy
} from 'lucide-react';

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

const POPULAR_SPOTS_ALIBAG = [
  { name: 'Kolaba Sea Fort', address: 'Near Alibag Beach', lat: 18.6300, lng: 72.8600, cat: 'attraction' },
  { name: 'Alibag Beach', address: 'Beach Rd, Alibag', lat: 18.6414, lng: 72.8722, cat: 'attraction' },
  { name: 'Varsoli Beach', address: 'Varsoli, Alibag', lat: 18.6600, lng: 72.8700, cat: 'attraction' },
  { name: 'Mandwa Jetty & Beach', address: 'Mandwa, Alibag', lat: 18.7900, lng: 72.8800, cat: 'activity' },
  { name: 'Nagaon Beach', address: 'Nagaon, Alibag', lat: 18.5700, lng: 72.9000, cat: 'activity' },
  { name: 'Kihim Beach', address: 'Kihim, Alibag', lat: 18.7200, lng: 72.8700, cat: 'attraction' },
  { name: 'Sanman Restaurant', address: 'Alibag City Center', lat: 18.6450, lng: 72.8740, cat: 'dining' },
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

  const [saving, setSaving] = useState(false);

  // Swap / Alternatives Modal State
  const [swappingItem, setSwappingItem] = useState<ItineraryItem | null>(null);
  const [movingDayItem, setMovingDayItem] = useState<ItineraryItem | null>(null);

  // Load everything
  const loadData = useCallback(async () => {
    try {
      const [
        tripRes,
        prefRes,
        daysRes,
        itemsRes,
        membersRes,
      ] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('trip_preferences').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('itinerary_days').select('*').eq('trip_id', tripId).order('day_index', { ascending: true }),
        supabase.from('itinerary_items').select('*, location:locations(*)').eq('trip_id', tripId).order('start_time', { ascending: true, nullsFirst: false }),
        supabase.from('trip_members').select('*').eq('trip_id', tripId),
      ]);

      if (tripRes.data) setTrip(tripRes.data);
      if (prefRes.data) setPreferences(prefRes.data);
      const loadedDays = daysRes.data || [];
      const loadedItems = itemsRes.data || [];
      const loadedMembers = membersRes.data || [];

      setDays(loadedDays);
      setItems(loadedItems);
      setMembers(loadedMembers);

      // Load participants
      if (loadedItems.length > 0) {
        const itemIds = loadedItems.map(i => i.id);
        const { data: allParts } = await supabase
          .from('item_participants')
          .select('*')
          .in('item_id', itemIds);

        const map: Record<string, ItemParticipant[]> = {};
        (allParts || []).forEach(p => {
          if (!map[p.item_id]) map[p.item_id] = [];
          map[p.item_id].push(p);
        });
        setParticipantsMap(map);
      }
    } catch (err) {
      console.error('Error loading itinerary data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        await supabase.from('itinerary_items').update({
          start_time: item.start_time,
          end_time: item.end_time,
          estimated_travel_time: item.estimated_travel_time,
          travel_distance_km: item.travel_distance_km,
          conflicts: item.conflicts,
        }).eq('id', item.id);
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

      await supabase.from('itinerary_items').update({
        itinerary_day_id: targetDay.id,
        start_time: newStartTime,
        end_time: newEndTime,
      }).eq('id', movingDayItem.id);

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
      await supabase.from('locations').upsert({
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

      await supabase.from('itinerary_items').update({
        label: alternative.name,
        location_id: alternative.id,
        short_description: alternative.description,
        cost: alternative.entry_fee + alternative.estimated_spending,
      }).eq('id', swappingItem.id);

      setSwappingItem(null);
      await loadData();
    } catch (err: any) {
      alert('Error swapping activity: ' + (err?.message || 'Unknown error'));
    }
  }

  // Form actions
  function openCreateModal(defaultDayId?: string) {
    setEditingId(null);
    setFormType('activity');
    setFormLabel('');
    setFormStartTime('');
    setFormEndTime('');
    setFormCost('');
    setFormSplitType('equal');
    setFormDescription('');
    setFormLocationName('');
    setFormAddress('');
    setFormLatitude('');
    setFormLongitude('');
    setFormSelectedMembers(members.map(m => m.id));
    setFormDayId(defaultDayId || (days[0]?.id || ''));
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
    setShowForm(true);
  }

  function handleSelectPresetLocation(preset: typeof POPULAR_SPOTS_ALIBAG[0]) {
    setFormLocationName(preset.name);
    setFormLabel(preset.name);
    setFormAddress(preset.address);
    setFormLatitude(preset.lat.toString());
    setFormLongitude(preset.lng.toString());
    if (preset.cat) setFormType(preset.cat as ItemType);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let locationId: string | null = null;

      // If location information / coordinates are provided, upsert into locations table
      if (formLocationName.trim() || (formLatitude && formLongitude)) {
        const locId = crypto.randomUUID();
        const { error: locErr } = await supabase.from('locations').upsert({
          id: locId,
          name: formLocationName.trim() || formLabel.trim(),
          category: formType === 'dining' ? 'restaurant' : formType === 'transfer' ? 'transit' : formType === 'hotel' ? 'hotel' : 'attraction',
          address: formAddress.trim() || null,
          latitude: formLatitude ? parseFloat(formLatitude) : null,
          longitude: formLongitude ? parseFloat(formLongitude) : null,
        });

        if (!locErr) {
          locationId = locId;
        }
      }

      const payload: any = {
        trip_id: tripId,
        type: formType,
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
        await supabase.from('itinerary_items').update(payload).eq('id', editingId);
      } else {
        const { data, error } = await supabase.from('itinerary_items').insert(payload).select().single();
        if (error) throw error;
        if (data) itemId = data.id;
      }

      if (itemId) {
        await supabase.from('item_participants').delete().eq('item_id', itemId);
        if (formSelectedMembers.length > 0) {
          const rows = formSelectedMembers.map(memberId => ({
            item_id: itemId!,
            member_id: memberId,
          }));
          await supabase.from('item_participants').insert(rows);
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
    await supabase.from('itinerary_items').update({ status: newStatus }).eq('id', item.id);
    loadData();
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Are you sure you want to remove this activity?')) return;
    await supabase.from('itinerary_items').delete().eq('id', id);
    loadData();
  }

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
    <div className="space-y-6 pb-24">
      {/* ── TOP DASHBOARD OVERVIEW ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 p-6 shadow-xs backdrop-blur-xs">
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

            {/* Add Activity */}
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
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
                ${totalCost.toLocaleString()}
              </span>
              {totalBudget > 0 && (
                <span className="text-xs text-slate-400 font-medium">/ ${totalBudget.toLocaleString()}</span>
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
      </div>

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

          {groupedDays.map(({ day, items: dItems }) => (
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
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedDayFilter === day.id ? 'bg-indigo-700/60 text-indigo-100' : 'bg-slate-100 text-slate-500'
              }`}>
                {dItems.length}
              </span>
            </button>
          ))}
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

                  return (
                    <div key={day.id} className="space-y-4">
                      {/* Day Header Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
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
                              {day.weather_forecast?.condition && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium">
                                  <Sun className="w-3 h-3 text-amber-500" />
                                  {day.weather_forecast.condition} • {day.weather_forecast.temp}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatDayDate(day.day_date)} • {dayItems.length} activities • ${dayCost.toLocaleString()} est.
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
                                <div
                                  className={`rounded-xl border p-4 transition-all duration-200 bg-white ${
                                    isCancelled
                                      ? 'opacity-60 border-slate-200 bg-slate-50/50'
                                      : isHighlighted
                                      ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100'
                                      : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-sm'
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
                                          {item.cost && item.cost > 0 ? `$${item.cost}` : 'Free'}
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
                                </div>

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
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* MAP COLUMN (Sticky on Desktop) */}
        {viewLayout !== 'timeline' && (
          <div className={viewLayout === 'split' ? 'lg:col-span-5 xl:col-span-5' : 'w-full'}>
            <div className="sticky top-20 space-y-3">
              <ItineraryMap
                items={mapItems}
                destination={trip?.destination}
                highlightedItemId={highlightedItemId}
                dayTitle={activeDayTitle}
                onAddLocationClick={() => openCreateModal()}
                onMapClick={(lat, lng) => {
                  openCreateModal();
                  setFormLatitude(lat.toFixed(6));
                  setFormLongitude(lng.toFixed(6));
                  setFormLocationName(`Custom Stop (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
                }}
                onMarkerClick={(itemId) => {
                  setHighlightedItemId(itemId);
                  const el = document.getElementById(`itin-item-${itemId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
                <span>Hover or click pins to inspect schedule stops</span>
                <span className="font-semibold text-indigo-600">{mapItems.length} plotted stops</span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── SWAP / ALTERNATIVES MODAL ── */}
      {swappingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Quick Replace</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Alternative Places for &ldquo;{swappingItem.label}&rdquo;
                </h2>
              </div>
              <button
                onClick={() => setSwappingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select an alternative recommendation below. The itinerary will automatically replace this activity, recompute travel buffers, and update the route line.
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {ALTERNATIVE_LOCATIONS.map(alt => (
                <div
                  key={alt.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600 capitalize bg-indigo-50 px-2 py-0.5 rounded-md">
                        {alt.category}
                      </span>
                      <span className="text-xs font-bold text-amber-600">
                        ★ {alt.rating}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {alt.name}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {alt.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span>📍 {alt.address}</span>
                      <span>⏱️ {alt.recommended_duration}</span>
                      <span>💵 {alt.entry_fee > 0 ? `$${alt.entry_fee} entry` : 'Free'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSwapActivity(alt)}
                    className="self-end px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
                  >
                    Swap with this place
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT DAY MODAL ── */}
      {movingDayItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Move to Another Day
              </h2>
              <button
                onClick={() => setMovingDayItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Choose which day you want to shift &ldquo;{movingDayItem.label}&rdquo; to:
            </p>

            <div className="space-y-2">
              {days.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleShiftDay(d.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 text-left text-xs font-semibold text-slate-800 transition"
                >
                  <span>Day {d.day_index} — {formatDayDate(d.day_date)}</span>
                  <span className="text-indigo-600 font-bold">Select &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT ACTIVITY MODAL (WITH MAP PIN ENTRY) ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Activity' : 'Add Activity & Map Pin'}
                </h2>
                <p className="text-xs text-slate-500">Assign a day, time slot, and location on the route map</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Activity Label */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kolaba Sea Fort or Seaside Lunch"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Quick Preset Places if destination matches Alibag */}
              {(trip?.destination || '').toLowerCase().includes('alibag') && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    Quick Pick Alibag Spot:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SPOTS_ALIBAG.map(spot => (
                      <button
                        type="button"
                        key={spot.name}
                        onClick={() => handleSelectPresetLocation(spot)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition font-medium"
                      >
                        + {spot.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Map Location & Coordinates */}
              <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-3">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                  Map Pin Details (Shows on Route Map)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Location / Venue Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Kolaba Fort"
                      value={formLocationName}
                      onChange={e => setFormLocationName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Address / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Alibag Beach Rd"
                      value={formAddress}
                      onChange={e => setFormAddress(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Day Assignment & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Assigned Day
                  </label>
                  <select
                    value={formDayId}
                    onChange={e => setFormDayId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="">Unscheduled / Flexible</option>
                    {days.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.day_index ? `Day ${d.day_index}` : 'Day'} — {formatDayDate(d.day_date)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as ItemType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Cost & Split Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Estimated Cost ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formCost}
                    onChange={e => setFormCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Split Type
                  </label>
                  <select
                    value={formSplitType}
                    onChange={e => setFormSplitType(e.target.value as SplitType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    {SPLIT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Details, reservation notes, ticket info, or reminders..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {members.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Included Travelers
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => {
                      const selected = formSelectedMembers.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => toggleMember(m.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                            selected
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {m.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Activity' : 'Add Activity & Pin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
