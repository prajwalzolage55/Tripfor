'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getTrips, createTrip as dbCreateTrip, joinTripByCode } from '@/lib/db';
import type { Trip } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import {
  Plane, Plus, LogIn, LogOut, MapPin, Calendar, Copy, Check,
  Loader2, Users, Compass, ArrowRight, Sparkles, Map, User
} from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  burgundy: '#791523',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#d05461'
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 14 }
  }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
};

export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  // Create form
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);

  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace('/login');
      return;
    }
    loadTrips();
  }, [authLoading, authUser]);

  async function loadTrips() {
    if (!authUser) return;
    try {
      const data = await getTrips(authUser.id);
      setTrips(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    if (!authUser) return;

    try {
      const trip = await dbCreateTrip({
        name: tripName,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null
      }, authUser.id, displayName || authUser.display_name || authUser.email?.split('@')[0] || 'Organizer');
      
      router.push(`/trip/${trip.id}/itinerary`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinTrip(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError('');
    if (!authUser) return;

    try {
      const tripId = await joinTripByCode(inviteCode.trim(), authUser.id, joinName);
      router.push(`/trip/${tripId}/itinerary`);
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="font-bold tracking-tight">Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <ReactLenis root>
      <main className="min-h-screen font-['Inter'] relative overflow-hidden pb-32" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        
        {/* Animated Background Orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundColor: COLORS.cream }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-20 mix-blend-multiply pointer-events-none" style={{ backgroundColor: COLORS.rose }} />

        {/* Navigation */}
        <nav className="relative z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md bg-[#fdfbfa]/80 border-b border-[#eadecd]/50">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.burgundy }}>
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight">Tripfor</span>
          </Link>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full hover:bg-black/5 transition-all font-bold text-sm"
            style={{ color: COLORS.burgundy }}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </nav>

        <div className="max-w-7xl mx-auto px-6 pt-16 relative z-10">
          
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border" style={{ backgroundColor: `${COLORS.rose}15`, borderColor: `${COLORS.rose}30`, color: COLORS.rose }}>
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-black tracking-widest uppercase">Dashboard</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] mb-6">
              Where to next, <br/><span style={{ color: COLORS.rose }}>{authUser?.display_name?.split(' ')[0] || 'Traveler'}?</span>
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <button 
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center px-8 py-4 text-base font-bold text-white rounded-full transition-transform hover:scale-105 shadow-xl hover:shadow-2xl gap-2"
                style={{ backgroundColor: COLORS.burgundy }}
              >
                <Plus className="w-5 h-5" /> Create a Trip
              </button>
              <button 
                onClick={() => setShowJoin(true)}
                className="flex items-center justify-center px-8 py-4 text-base font-bold rounded-full transition-transform hover:scale-105 shadow-md hover:shadow-lg border-2 gap-2"
                style={{ backgroundColor: COLORS.offWhite, borderColor: COLORS.burgundy, color: COLORS.burgundy }}
              >
                <LogIn className="w-5 h-5" /> Join Trip
              </button>
            </div>
          </motion.div>

          {/* Trips Grid */}
          <div className="mb-12 flex items-center justify-between border-b pb-4" style={{ borderColor: COLORS.cream }}>
            <h2 className="text-3xl font-black tracking-tight">Your Journeys</h2>
            <span className="px-4 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: COLORS.cream }}>
              {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}
            </span>
          </div>

          {trips.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="py-24 text-center rounded-[2rem] border-2 border-dashed"
              style={{ borderColor: COLORS.cream, backgroundColor: `${COLORS.cream}30` }}
            >
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: COLORS.cream }}>
                <Map className="w-8 h-8 opacity-60" style={{ color: COLORS.burgundy }} />
              </div>
              <h3 className="text-2xl font-black mb-3">No trips planned yet</h3>
              <p className="text-lg opacity-70 font-medium max-w-md mx-auto mb-8">
                Your adventure awaits. Create a new trip to start building your itinerary and splitting costs.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {trips.map((trip) => (
                <motion.div 
                  key={trip.id}
                  variants={fadeUp}
                  whileHover={{ y: -8, scale: 1.02 }}
                  onClick={() => router.push(`/trip/${trip.id}/itinerary`)}
                  className="group relative cursor-pointer p-8 rounded-[2rem] shadow-lg hover:shadow-2xl transition-all duration-300 border bg-white"
                  style={{ borderColor: COLORS.cream }}
                >
                  <div className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:rotate-45" style={{ backgroundColor: COLORS.cream, color: COLORS.burgundy }}>
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <h3 className="text-2xl font-black tracking-tight mb-4 pr-12 line-clamp-2 leading-tight">
                    {trip.name}
                  </h3>
                  
                  <div className="space-y-3 mb-8">
                    {trip.destination && (
                      <div className="flex items-center gap-3 font-semibold opacity-80">
                        <MapPin className="w-4 h-4" /> {trip.destination}
                      </div>
                    )}
                    {trip.start_date && (
                      <div className="flex items-center gap-3 font-semibold opacity-80">
                        <Calendar className="w-4 h-4" />
                        {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {trip.end_date && ` — ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t flex items-center justify-between" style={{ borderColor: COLORS.cream }}>
                    <div 
                      onClick={(e) => { e.stopPropagation(); copyCode(trip.invite_code); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold transition-colors hover:bg-black/5"
                      style={{ color: COLORS.burgundy, backgroundColor: COLORS.cream }}
                      title="Copy Invite Code"
                    >
                      <Users className="w-4 h-4" />
                      {trip.invite_code}
                      {copiedCode === trip.invite_code ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 opacity-50" />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Create Trip Modal */}
        <AnimatePresence>
          {showCreate && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowCreate(false)}
              />
              <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-full max-w-lg p-8 rounded-[2rem] shadow-2xl bg-white border"
                style={{ borderColor: COLORS.cream }}
              >
                <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.burgundy }}>Create a New Trip</h2>
                <form onSubmit={createTrip} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Trip Name</label>
                    <input type="text" required value={tripName} onChange={e => setTripName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="e.g. Summer in Tokyo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Your Display Name</label>
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="How friends will see you"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Destination (Optional)</label>
                    <input type="text" value={destination} onChange={e => setDestination(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="e.g. Tokyo, Japan"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Start Date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} 
                        className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                        style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">End Date</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} 
                        className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                        style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={creating} className="flex-1 py-4 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.burgundy }}>
                      {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Create Trip
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)} className="px-8 py-4 rounded-2xl font-bold transition-colors hover:bg-gray-100 bg-gray-50 border">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Join Trip Modal */}
        <AnimatePresence>
          {showJoin && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowJoin(false)}
              />
              <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-full max-w-md p-8 rounded-[2rem] shadow-2xl bg-white border"
                style={{ borderColor: COLORS.cream }}
              >
                <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.burgundy }}>Join a Trip</h2>
                <form onSubmit={joinTrip} className="space-y-5">
                  {joinError && (
                    <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-sm font-bold border border-red-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> {joinError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Invite Code</label>
                    <input type="text" required value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-bold font-mono tracking-[0.2em] text-lg text-center shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all uppercase"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="XXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Your Display Name</label>
                    <input type="text" required value={joinName} onChange={e => setJoinName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="How friends will see you"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={joining} className="flex-1 py-4 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.rose }}>
                      {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                      Join Trip
                    </button>
                    <button type="button" onClick={() => setShowJoin(false)} className="px-6 py-4 rounded-2xl font-bold transition-colors hover:bg-gray-100 bg-gray-50 border">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </ReactLenis>
  );
}
