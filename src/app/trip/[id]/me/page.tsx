'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { computeSettlements, type RawExpense } from '@/lib/engine';
import type { Expense, ItineraryItem, TripMember, ItemParticipant, SplitType } from '@/lib/types';
import type { Settlement } from '@/lib/engine';
import {
  User, DollarSign, ArrowRight, ArrowDown, ArrowUp,
  Loader2, CheckCircle2, Clock, ExternalLink, Receipt,
  Plane, Hotel, Activity, Car, UtensilsCrossed, MoreHorizontal,
  Map as LucideMap,
} from 'lucide-react';

function typeIcon(type: string) {
  switch (type) {
    case 'flight': return Plane;
    case 'hotel': return Hotel;
    case 'activity': return Activity;
    case 'transfer': return Car;
    case 'dining': return UtensilsCrossed;
    default: return MoreHorizontal;
  }
}

export default function MePage() {
  const params = useParams();
  const tripId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<TripMember | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [myItems, setMyItems] = useState<ItineraryItem[]>([]);
  const [myExpenses, setMyExpenses] = useState<Expense[]>([]);
  const [balance, setBalance] = useState(0);
  const [mySettlements, setMySettlements] = useState<Settlement[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalShare, setTotalShare] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem('gtl_user');
      if (!storedUser) {
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(storedUser);

      const memQ = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));
      const expQ = query(collection(db, 'expenses'), where('trip_id', '==', tripId));
      const itemQ = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId));

      const [memRes, expRes, itemRes] = await Promise.all([
        getDocs(memQ),
        getDocs(expQ),
        getDocs(itemQ),
      ]);

      const loadedMembers = memRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));
      const loadedExpenses = expRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Expense));
      const loadedItems = itemRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryItem));
      setMembers(loadedMembers);

      const me = loadedMembers.find(m => m.user_id === parsed.id);
      if (!me) {
        setLoading(false);
        return;
      }
      setCurrentMember(me);

      // Get cancelled item IDs
      const cancelledIds = new Set(loadedItems.filter(i => i.status === 'cancelled').map(i => i.id));

      const partsQ = query(collection(db, 'item_participants'));
      const partsRes = await getDocs(partsQ);
      const allPartsRaw = partsRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItemParticipant));
      const allItemIds = new Set(loadedItems.map(i => i.id));
      const allParts = allPartsRaw.filter(p => allItemIds.has(p.item_id));

      // Build participant map
      const partMap: Record<string, ItemParticipant[]> = {};
      allParts.forEach(p => {
        if (!partMap[p.item_id]) partMap[p.item_id] = [];
        partMap[p.item_id].push(p);
      });

      // My items: items where I'm a participant
      const myItemIds = new Set(allParts.filter(p => p.member_id === me.id).map(p => p.item_id));
      setMyItems(loadedItems.filter(i => myItemIds.has(i.id)));

      // My expenses (paid by me or involving me)
      const myExps = loadedExpenses.filter(exp => {
        if (exp.paid_by === me.id) return true;
        if (exp.item_id && myItemIds.has(exp.item_id)) return true;
        if (!exp.item_id) return true; // General expense involves everyone
        return false;
      });
      setMyExpenses(myExps);

      // Run calculation engine for all expenses
      const memberIds = loadedMembers.map(m => m.id);
      const rawExpenses: RawExpense[] = loadedExpenses.map(exp => {
        const participants = exp.item_id && partMap[exp.item_id]
          ? partMap[exp.item_id].map(p => ({ memberId: p.member_id, percentage: p.percentage ?? undefined }))
          : memberIds.map(id => ({ memberId: id }));
        return {
          id: exp.id,
          amount: Number(exp.amount),
          paidBy: exp.paid_by,
          splitType: exp.split_type as SplitType,
          itemId: exp.item_id,
          participants,
        };
      });

      const result = computeSettlements(rawExpenses, memberIds, cancelledIds);
      setBalance(result.balances[me.id] || 0);

      // My settlements
      const mySettles = result.settlements.filter(s => s.from === me.id || s.to === me.id);
      setMySettlements(mySettles);

      // Compute total paid by me
      const paid = loadedExpenses
        .filter(e => e.paid_by === me.id && !(e.item_id && cancelledIds.has(e.item_id)))
        .reduce((s, e) => s + Number(e.amount), 0);
      setTotalPaid(paid);

      // Compute total share for me
      let share = 0;
      result.expenseDetails.forEach(exp => {
        if (exp.shares[me.id]) share += exp.shares[me.id];
      });
      setTotalShare(Math.round(share * 100) / 100);
    } catch (err) {
      console.error('Failed to load me page data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const memberName = (id: string) => members.find(m => m.id === id)?.display_name || '?';

  function generateUPILink(payeeName: string, amount: number) {
    return `upi://pay?pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={24} className="spin" style={{ color: 'var(--color-brand-500)' }} /></div>;
  }

  if (!currentMember) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
        <p>You are not a member of this trip.</p>
      </div>
    );
  }

  return (
    <div className="me-page">
      <style>{`
        .me-page { }
        .me-header {
          margin-bottom: 1.5rem;
        }
        .me-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .me-header .sub {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }
        .me-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .me-stat {
          padding: 1.25rem;
        }
        .me-stat .label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.375rem;
        }
        .me-stat .value {
          font-size: 1.5rem;
          font-weight: 800;
        }
        .section-title {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .my-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }
        .my-item-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1.25rem;
        }
        .my-item-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .my-item-row .name {
          flex: 1;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .my-item-row .cost {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }
        .settlement-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .settlement-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
        }
        .settlement-flow {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
        .settlement-name {
          font-weight: 600;
          font-size: 0.875rem;
        }
        .settlement-name.you {
          color: var(--color-brand-400);
        }
        .settlement-amount {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-brand-400);
          white-space: nowrap;
        }
        .settlement-upi {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-button);
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: var(--color-success-500);
          font-size: 0.75rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }
        .settlement-upi:hover {
          background: rgba(34, 197, 94, 0.2);
        }
        .direction-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-badge);
          font-size: 0.6875rem;
          font-weight: 700;
        }
        .direction-badge.owe {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
        }
        .direction-badge.receive {
          background: rgba(34, 197, 94, 0.1);
          color: #4ade80;
        }
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--color-text-secondary);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="me-header">
        <h2>👤 My Dashboard</h2>
        <div className="sub">Logged in as <strong>{currentMember.display_name}</strong></div>
      </div>

      {/* Stats */}
      <div className="me-stats">
        <div className="me-stat glass-card animate-in">
          <div className="label">My Total Paid</div>
          <div className="value" style={{ color: 'var(--color-success-500)' }}>₹{totalPaid.toLocaleString('en-IN')}</div>
        </div>
        <div className="me-stat glass-card animate-in" style={{ animationDelay: '0.05s' }}>
          <div className="label">My Total Share</div>
          <div className="value">₹{totalShare.toLocaleString('en-IN')}</div>
        </div>
        <div className="me-stat glass-card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="label">Net Balance</div>
          <div className="value" style={{ color: balance > 0.01 ? 'var(--color-success-500)' : balance < -0.01 ? 'var(--color-danger-500)' : 'var(--color-text-muted)' }}>
            {balance > 0.01 ? '+' : ''}₹{Math.abs(balance).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="me-stat glass-card animate-in" style={{ animationDelay: '0.15s' }}>
          <div className="label">My Items</div>
          <div className="value">{myItems.length}</div>
        </div>
      </div>

      {/* My Settlements */}
      <div className="section-title"><DollarSign size={18} /> My Settlements</div>
      {mySettlements.length === 0 ? (
        <div className="empty-state glass-card" style={{ marginBottom: '2rem' }}>
          <CheckCircle2 size={28} style={{ color: 'var(--color-success-500)', marginBottom: '0.5rem' }} />
          <p>You&apos;re all settled up!</p>
        </div>
      ) : (
        <div className="settlement-list">
          {mySettlements.map((s, i) => {
            const iOwe = s.from === currentMember.id;
            const otherName = iOwe ? memberName(s.to) : memberName(s.from);
            const upiLink = iOwe ? generateUPILink(memberName(s.to), s.amount) : null;
            return (
              <div key={i} className="settlement-card glass-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`direction-badge ${iOwe ? 'owe' : 'receive'}`}>
                  {iOwe ? <><ArrowUp size={12} /> You owe</> : <><ArrowDown size={12} /> Receives</>}
                </div>
                <div className="settlement-flow">
                  <span className="settlement-name">{otherName}</span>
                </div>
                <span className="settlement-amount">₹{s.amount.toLocaleString('en-IN')}</span>
                {iOwe && upiLink && (
                  <a href={upiLink} className="settlement-upi" target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} /> Pay via UPI
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* My Itinerary Items */}
      <div className="section-title"><LucideMap size={18} /> My Itinerary Items</div>
      {myItems.length === 0 ? (
        <div className="empty-state glass-card" style={{ marginBottom: '2rem' }}>
          <p>No items assigned to you yet.</p>
        </div>
      ) : (
        <div className="my-items-list">
          {myItems.map((item, i) => {
            const Icon = typeIcon(item.type);
            return (
              <div key={item.id} className="my-item-row glass-card animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className={`my-item-icon badge-${item.type}`}>
                  <Icon size={16} />
                </div>
                <div className="name">
                  {item.label}
                  {item.status === 'cancelled' && <span className="badge badge-cancelled" style={{ marginLeft: '0.5rem' }}>Cancelled</span>}
                </div>
                <div className="cost">
                  {item.cost > 0 ? `₹${item.cost.toLocaleString('en-IN')}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapIcon(props: { size?: number }) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}
