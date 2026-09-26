'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getTrips, createTrip as dbCreateTrip, joinTripByCode } from '@/lib/db';
import type { Trip } from '@/lib/types';
import { Plane, Plus, LogIn, LogOut, MapPin, Calendar, Copy, Check, Loader2, Users } from 'lucide-react';

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--color-brand-500)' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`}</style>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <style>{`
        .dash-page {
          min-height: 100vh;
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
        }
        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }
        .dash-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .dash-logo .icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dash-logo h1 {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .dash-actions {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .trip-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }
        .trip-card {
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .trip-card:hover {
          transform: translateY(-2px);
        }
        .trip-card h3 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .trip-meta {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }
        .trip-meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .invite-code {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-input);
          background: var(--color-surface-100);
          font-family: monospace;
          font-size: 0.875rem;
          color: var(--color-brand-400);
          cursor: pointer;
          border: 1px solid transparent;
          transition: border-color 0.2s ease;
        }
        .invite-code:hover {
          border-color: var(--color-brand-500);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1.5rem;
        }
        .modal-card {
          width: 100%;
          max-width: 440px;
          padding: 2rem;
        }
        .modal-card h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .form-group label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: var(--color-text-secondary);
        }
        .empty-state h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
        }
        .empty-state p {
          margin-bottom: 2rem;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="dash-header">
        <div className="dash-logo">
          <div className="icon-wrap">
            <Plane size={20} color="white" />
          </div>
          <h1 className="gradient-text">GroupTrip Ledger</h1>
        </div>
        <button className="btn-secondary" onClick={handleSignOut} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="dash-actions">
        <button className="btn-primary" onClick={() => router.push('/trip/create')}>
          <Plus size={16} /> Create Trip
        </button>
        <button className="btn-secondary" onClick={() => setShowJoin(true)}>
          <LogIn size={16} /> Join Trip
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="empty-state glass-card animate-in">
          <Plane size={48} style={{ color: 'var(--color-brand-500)', marginBottom: '1rem' }} />
          <h2>No trips yet</h2>
          <p>Create your first trip or join an existing one with an invite code.</p>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip, i) => (
            <div
              key={trip.id}
              className="trip-card glass-card animate-in"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => router.push(`/trip/${trip.id}/itinerary`)}
            >
              <h3>{trip.name}</h3>
              <div className="trip-meta">
                {trip.destination && (
                  <div className="trip-meta-item">
                    <MapPin size={14} /> {trip.destination}
                  </div>
                )}
                {trip.start_date && (
                  <div className="trip-meta-item">
                    <Calendar size={14} />
                    {new Date(trip.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {trip.end_date && ` — ${new Date(trip.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </div>
                )}
              </div>
              <div
                className="invite-code"
                onClick={(e) => { e.stopPropagation(); copyCode(trip.invite_code); }}
                title="Click to copy invite code"
              >
                <Users size={14} />
                {trip.invite_code}
                {copiedCode === trip.invite_code ? <Check size={14} style={{ color: 'var(--color-success-500)' }} /> : <Copy size={14} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Trip Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card glass-card animate-in" onClick={e => e.stopPropagation()}>
            <h2>🗺️ Create a New Trip</h2>
            <form onSubmit={createTrip} className="modal-form">
              <div className="form-group">
                <label>Trip Name *</label>
                <input className="input-field" placeholder="Goa Weekend Getaway" value={tripName} onChange={e => setTripName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Your Display Name *</label>
                <input className="input-field" placeholder="What should others call you?" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Destination</label>
                <input className="input-field" placeholder="Goa, India" value={destination} onChange={e => setDestination(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={creating} style={{ flex: 1 }}>
                  {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                  Create Trip
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Trip Modal */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-card glass-card animate-in" onClick={e => e.stopPropagation()}>
            <h2>🔗 Join a Trip</h2>
            <form onSubmit={joinTrip} className="modal-form">
              {joinError && <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.8125rem' }}>{joinError}</div>}
              <div className="form-group">
                <label>Invite Code *</label>
                <input className="input-field" placeholder="e.g. a1b2c3" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.15em' }} />
              </div>
              <div className="form-group">
                <label>Your Display Name *</label>
                <input className="input-field" placeholder="What should others call you?" value={joinName} onChange={e => setJoinName(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={joining} style={{ flex: 1 }}>
                  {joining ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
                  Join Trip
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowJoin(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
