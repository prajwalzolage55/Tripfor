'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { getTrip } from '@/lib/db';
import { useAuth } from '@/components/AuthProvider';
import type { Trip } from '@/lib/types';
import { motion } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { Map, Receipt, Users, User, ArrowLeft, Copy, Check, History, GitFork, Scale, Plane } from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  burgundy: '#791523',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#d05461'
};

const NAV_ITEMS = [
  { key: 'itinerary', label: 'Itinerary', icon: Map },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'what-if', label: 'What-If Fork', icon: GitFork },
  { key: 'ledger', label: 'Ledger Stream', icon: History },
  { key: 'fairness', label: 'Constitution', icon: Scale },
  { key: 'group', label: 'Group', icon: Users },
  { key: 'me', label: 'My View', icon: User },
];

export default function TripLayoutClient({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tripId = params?.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [copied, setCopied] = useState(false);
  const { user: authUser, loading: authLoading } = useAuth();

  const activeTab = pathname.split('/').pop() || 'itinerary';

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace('/login');
      return;
    }
    if (!tripId || tripId === 'view') return;
    async function load() {
      try {
        const data = await getTrip(tripId);
        if (data) setTrip(data);
      } catch (err) {
        console.error('Failed to load trip:', err);
      }
    }
    load();
  }, [tripId, router, authUser, authLoading]);

  async function copyInvite() {
    if (trip) {
      await navigator.clipboard.writeText(trip.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ReactLenis root>
      <div className="min-h-screen flex flex-col font-['Inter']" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        
        {/* Top Navbar */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-lg border-b bg-[#fdfbfa]/90" style={{ borderColor: `${COLORS.cream}` }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:-translate-x-1 hover:bg-black/5"
              style={{ color: COLORS.burgundy }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight leading-none">{trip?.name || 'Loading Trip...'}</h1>
              {trip?.destination && <span className="text-sm font-semibold opacity-60 mt-1">{trip.destination}</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {trip && (
              <button
                onClick={copyInvite}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold transition-all hover:scale-105 shadow-sm"
                style={{ backgroundColor: COLORS.cream, color: COLORS.burgundy }}
                title="Copy Invite Code"
              >
                {trip.invite_code}
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </nav>

        {/* Tab Navigation */}
        <div className="sticky top-[73px] z-40 border-b bg-[#fdfbfa]/95 backdrop-blur-md overflow-x-auto scrollbar-hide" style={{ borderColor: COLORS.cream }}>
          <div className="flex px-4 max-w-7xl mx-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => router.push(`/trip/${tripId}/${item.key}`)}
                  className={`relative flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap transition-colors`}
                  style={{ color: isActive ? COLORS.burgundy : `${COLORS.burgundy}80` }}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full"
                      style={{ backgroundColor: COLORS.rose }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </ReactLenis>
  );
}
