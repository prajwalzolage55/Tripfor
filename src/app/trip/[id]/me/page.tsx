'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { computeSettlements, type RawExpense } from '@/lib/engine';
import { getEventStream, replayEvents, generateBalanceTrace, type BalanceTrace, type LedgerEvent } from '@/lib/ledger';
import type { Expense, ItineraryItem, TripMember, ItemParticipant, SplitType } from '@/lib/types';
import type { Settlement } from '@/lib/engine';
import {
  User, DollarSign, ArrowRight, ArrowDown, ArrowUp,
  Loader2, CheckCircle2, Clock, ExternalLink, Receipt,
  Plane, Hotel, Activity, Car, UtensilsCrossed, MoreHorizontal,
  Map as LucideMap, HelpCircle, ShieldCheck, X, Sparkles, Lock,
  Scale,
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

  // Event stream balance trace state
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [trace, setTrace] = useState<BalanceTrace[]>([]);
  const [showTraceModal, setShowTraceModal] = useState(false);

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

      // Load event-sourced balance trace
      try {
        const stream = await getEventStream(tripId);
        setEvents(stream);
        if (stream.length > 0) {
          const derived = replayEvents(tripId, stream);
          const traces = generateBalanceTrace(tripId, stream, me.id, derived.constitution);
          setTrace(traces);
        }
      } catch (streamErr) {
        console.warn('Ledger stream load warning:', streamErr);
      }
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
        .why-owe-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.5rem;
          padding: 0.3125rem 0.625rem;
          font-size: 0.6875rem;
          font-weight: 700;
          border-radius: var(--radius-badge);
          background: rgba(92, 124, 250, 0.12);
          border: 1px solid rgba(92, 124, 250, 0.3);
          color: var(--color-brand-600);
          cursor: pointer;
          transition: all 0.2s;
        }
        .why-owe-btn:hover {
          background: rgba(92, 124, 250, 0.22);
          transform: translateY(-1px);
        }
        .privacy-lens-box {
          padding: 1rem 1.25rem;
          border-radius: var(--radius-card);
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          margin-bottom: 2rem;
          font-size: 0.75rem;
          color: #475569;
        }
        .trace-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .trace-modal {
          background: white;
          border-radius: 1.25rem;
          max-width: 680px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
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
          <button
            onClick={() => setShowTraceModal(true)}
            className="why-owe-btn"
          >
            <HelpCircle size={12} /> Why do I owe this?
          </button>
        </div>
        <div className="me-stat glass-card animate-in" style={{ animationDelay: '0.15s' }}>
          <div className="label">My Items</div>
          <div className="value">{myItems.length}</div>
        </div>
      </div>

      {/* Personal Impact Lens */}
      <div className="privacy-lens-box animate-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 700, color: '#1e293b' }}>
            <Lock size={13} style={{ color: 'var(--color-brand-500)' }} />
            Personal Impact Lens (Privacy-Scoped)
          </div>
          <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>
            Consent-Protected
          </span>
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Your view only displays your personal consumption and payments. Group totals are shown in aggregate, and individual bank feeds remain protected under RBI Account Aggregator protocol.
        </p>
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

      {/* ─── Balance Trace Modal ─── */}
      {showTraceModal && (
        <div className="trace-modal-backdrop" onClick={() => setShowTraceModal(false)}>
          <div className="trace-modal animate-in" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <ShieldCheck size={14} /> Immutable Event Trace
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0.25rem 0 0', color: '#0f172a' }}>
                  Why do I owe {balance > 0.01 ? '+' : ''}₹{Math.abs(balance).toLocaleString('en-IN')}?
                </h3>
              </div>
              <button
                onClick={() => setShowTraceModal(false)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Trace Summary Breakdown */}
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Total Paid Out</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>+₹{totalPaid.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Consumed Share</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>-₹{totalShare.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Net Derived Balance</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: balance >= 0 ? '#16a34a' : '#dc2626' }}>
                  {balance >= 0 ? '+' : ''}₹{balance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Chronological Event Stream Decomposition */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Chronological Event-by-Event Replay
              </h4>

              {trace.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {trace.map((item, idx) => (
                    <div
                      key={idx}
                      style={{ padding: '0.875rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem', borderRadius: '4px', background: '#e2e8f0', color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                              {item.eventType}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                              {item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>
                            {item.description}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, fontFamily: 'monospace', color: item.impact > 0 ? '#16a34a' : item.impact < 0 ? '#dc2626' : '#64748b' }}>
                            {item.impact > 0 ? `+₹${item.impact.toLocaleString('en-IN')}` : item.impact < 0 ? `-₹${Math.abs(item.impact).toLocaleString('en-IN')}` : '₹0'}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            Run: ₹{item.runningBalance.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {item.applicableRule && (
                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#eef2ff', border: '1px solid #e0e7ff', fontSize: '0.75rem', color: '#3730a3' }}>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.125rem' }}>
                            <Scale size={12} />
                            Rule {item.applicableRule.ruleNumber}: {item.applicableRule.ruleName}
                          </div>
                          <div style={{ fontStyle: 'italic', color: '#4338ca' }}>
                            {item.applicableRule.citation}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '0.75rem', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 0.5rem' }}>
                    <strong>Derived from Active Ledger Calculations:</strong>
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <li>Total amount you personally paid upfront: <strong>₹{totalPaid.toLocaleString('en-IN')}</strong></li>
                    <li>Your allocated share across all active items: <strong>₹{totalShare.toLocaleString('en-IN')}</strong></li>
                    <li>
                      Result: You {balance < 0 ? 'owe' : 'are owed'} <strong>₹{Math.abs(balance).toLocaleString('en-IN')}</strong>.
                    </li>
                  </ul>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                    Every balance change adheres to the Fairness Constitution rules. No arbitrary overrides.
                  </p>
                </div>
              )}

              {/* Constitution Rule Citation Footer */}
              <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#3730a3' }}>
                <ShieldCheck size={16} />
                <span>
                  Governed by <strong>Rule #1 (Late Joiner Protection)</strong> & <strong>Rule #7 (Refund to Original Funder)</strong>.
                </span>
              </div>
            </div>
          </div>
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
