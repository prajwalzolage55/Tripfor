'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Trip, TripMember } from '@/lib/types';
import { Plane, Map, Receipt, Users, User, ArrowLeft, Copy, Check } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'itinerary', label: 'Itinerary', icon: Map },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'group', label: 'Group', icon: Users },
  { key: 'me', label: 'My View', icon: User },
];

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [copied, setCopied] = useState(false);

  const activeTab = pathname.split('/').pop() || 'itinerary';

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (data) setTrip(data);
    }
    load();
  }, [tripId, router]);

  async function copyInvite() {
    if (trip) {
      await navigator.clipboard.writeText(trip.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="trip-layout">
      <style>{`
        .trip-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .trip-topbar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1.5rem;
          border-bottom: 1px solid var(--color-glass-border);
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .trip-topbar-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--color-glass-border);
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .trip-topbar-back:hover {
          background: var(--color-surface-100);
          color: var(--color-text-primary);
        }
        .trip-topbar-info {
          flex: 1;
          min-width: 0;
        }
        .trip-topbar-info h1 {
          font-size: 1rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .trip-topbar-info .sub {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
        .trip-invite-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-input);
          background: var(--color-surface-100);
          border: 1px solid var(--color-glass-border);
          color: var(--color-brand-400);
          font-family: monospace;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .trip-invite-btn:hover {
          border-color: var(--color-brand-500);
        }
        .trip-nav {
          display: flex;
          border-bottom: 1px solid var(--color-glass-border);
          background: var(--color-surface-0);
          overflow-x: auto;
        }
        .trip-nav-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-muted);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .trip-nav-item:hover {
          color: var(--color-text-secondary);
        }
        .trip-nav-item.active {
          color: var(--color-brand-400);
          border-bottom-color: var(--color-brand-500);
        }
        .trip-content {
          flex: 1;
          padding: 1.5rem;
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
        }
        @media (max-width: 640px) {
          .trip-content {
            padding: 1rem;
          }
          .trip-nav-item {
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
          }
        }
      `}</style>

      <div className="trip-topbar">
        <button className="trip-topbar-back" onClick={() => router.push('/dashboard')}>
          <ArrowLeft size={16} />
        </button>
        <div className="trip-topbar-info">
          <h1>{trip?.name || '...'}</h1>
          {trip?.destination && <span className="sub">{trip.destination}</span>}
        </div>
        {trip && (
          <button className="trip-invite-btn" onClick={copyInvite} title="Copy invite code">
            {trip.invite_code}
            {copied ? <Check size={14} style={{ color: 'var(--color-success-500)' }} /> : <Copy size={14} />}
          </button>
        )}
      </div>

      <nav className="trip-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`trip-nav-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => router.push(`/trip/${tripId}/${item.key}`)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="trip-content">
        {children}
      </div>
    </div>
  );
}
