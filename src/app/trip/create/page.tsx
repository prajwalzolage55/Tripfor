'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createTrip, saveTripPreferences } from '@/lib/db';
import { generateTripItinerary } from '@/lib/generate';
import { ChevronRight, ChevronLeft, Loader2, Plane, MapPin, Calendar, Users, IndianRupee, Activity, Navigation, Coffee, Home, Sparkles } from 'lucide-react';

const TRAVEL_STYLES = ['Budget', 'Relaxed', 'Balanced', 'Packed', 'Luxury'];
const INTERESTS_LIST = ['Beaches', 'Food', 'History', 'Culture', 'Adventure', 'Nature', 'Shopping', 'Nightlife', 'Photography', 'Architecture', 'Family'];
const TRANSPORT_LIST = ['Walking', 'Public transport', 'Taxi', 'Rental car', 'Rental bike', 'Mixed'];

export default function CreateTripWizard() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basics
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [travelers, setTravelers] = useState(2);

  // Step 2: Budget & Style
  const [budget, setBudget] = useState('');
  const [travelStyle, setTravelStyle] = useState('Balanced');

  // Step 3: Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [specialReqs, setSpecialReqs] = useState('');

  // Step 4: Logistics
  const [transport, setTransport] = useState<string[]>([]);
  const [food, setFood] = useState('');
  const [accommodation, setAccommodation] = useState('');

  const toggleInterest = (i: string) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };
  const toggleTransport = (t: string) => {
    setTransport(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  async function handleCreateTrip() {
    setLoading(true);
    try {
      if (!authUser) throw new Error('Not authenticated');

      // 1 & 2. Create Trip & Add as member
      const trip = await createTrip({
        name: tripName,
        destination,
        start_date: startDate || null,
        end_date: endDate || null
      }, authUser.id, displayName || authUser.display_name || authUser.email?.split('@')[0] || 'Organizer');

      // 3. Save Preferences
      await saveTripPreferences({
        trip_id: trip.id,
        total_budget: budget ? parseFloat(budget) : null,
        travel_style: travelStyle,
        interests,
        transport_preferences: transport,
        food_preferences: food ? food.split(',').map(s => s.trim()) : [],
        accommodation_preference: accommodation,
        special_requirements: specialReqs
      });

      // 4. Generate the itinerary using the hybrid engine
      await generateTripItinerary(trip.id);

      // Finish & Redirect to generated dashboard
      router.push(`/trip/${trip.id}/itinerary`);
    } catch (err: any) {
      alert('Error creating trip: ' + err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-glow">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-headline-sm text-on-surface font-semibold m-0 leading-tight">Itinerary Planner</h1>
              <p className="text-secondary font-body-sm m-0 mt-0.5">Step {step} of 4</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="text-secondary hover:text-on-surface transition-colors font-body-sm">
            Cancel
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">The Basics</h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Trip Name *</label>
                <div className="relative">
                  <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="E.g., Kyoto Autumn Retreat" value={tripName} onChange={e => setTripName(e.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Your Display Name *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="Alex" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Destination *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="Kyoto, Japan" value={destination} onChange={e => setDestination(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input type="date" className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input type="date" className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Budget & Travel Style</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Number of Travelers</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input type="number" min="1" className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" value={travelers} onChange={e => setTravelers(parseInt(e.target.value))} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Total Budget</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input type="number" className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="e.g. 50000" value={budget} onChange={e => setBudget(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Travel Style</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TRAVEL_STYLES.map(style => (
                    <button key={style} type="button" onClick={() => setTravelStyle(style)} className={`p-3 rounded-lg border text-center font-body-sm transition-colors ${travelStyle === style ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant hover:border-outline text-secondary hover:text-on-surface'}`}>
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Interests & Vibe</h2>
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">What are you interested in?</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS_LIST.map(interest => {
                    const active = interests.includes(interest);
                    return (
                      <button key={interest} type="button" onClick={() => toggleInterest(interest)} className={`px-4 py-2 rounded-full border font-body-sm transition-colors flex items-center gap-2 ${active ? 'bg-primary-container text-on-primary-container border-primary-container font-medium' : 'bg-surface-container-lowest border-outline-variant text-secondary hover:bg-surface-container-low'}`}>
                        {interest}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Special Requirements</label>
                <textarea className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors min-h-[100px]" placeholder="Any physical constraints, required stops, or other must-haves..." value={specialReqs} onChange={e => setSpecialReqs(e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Logistics & Comfort</h2>
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Preferred Transport</label>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORT_LIST.map(t => {
                    const active = transport.includes(t);
                    return (
                      <button key={t} type="button" onClick={() => toggleTransport(t)} className={`px-3 py-1.5 rounded border font-body-sm transition-colors flex items-center gap-2 ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant text-secondary hover:bg-surface-container-high'}`}>
                        <Navigation size={14} /> {t}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Food Preferences</label>
                <div className="relative">
                  <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="e.g. Vegetarian, Street food, Fine dining" value={food} onChange={e => setFood(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Accommodation Preference</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-md focus:border-primary focus:outline-none transition-colors" placeholder="e.g. Hostels, Boutique Hotels, Resorts" value={accommodation} onChange={e => setAccommodation(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
          <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || loading} className="flex items-center gap-1.5 px-4 py-2 font-body-sm font-medium text-secondary hover:text-on-surface disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          
          {step < 4 ? (
            <button type="button" onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 1 && (!tripName || !destination || !displayName)} className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg font-body-sm font-medium transition-colors disabled:opacity-50">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleCreateTrip} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg font-body-sm font-medium transition-colors disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate Itinerary
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
