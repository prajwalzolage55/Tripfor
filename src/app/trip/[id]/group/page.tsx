'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { computeSettlements, type RawExpense } from '@/lib/engine';
import type { Expense, ItineraryItem, TripMember, ItemParticipant, SplitType } from '@/lib/types';
import type { Settlement } from '@/lib/engine';
import {
  Users, DollarSign, ArrowRight, TrendingUp, PieChart as PieChartIcon,
  Loader2, CheckCircle2, Clock, ExternalLink, RefreshCw,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHART_COLORS = ['#5c7cfa', '#fab005', '#40c057', '#fa5252', '#c084fc', '#f59f00', '#4ecdc4', '#ff6b6b'];

export default function GroupPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementStatuses, setSettlementStatuses] = useState<Record<string, 'pending' | 'paid'>>({});
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [memberSpendData, setMemberSpendData] = useState<{ name: string; paid: number; owes: number }[]>([]);

  const loadData = useCallback(async () => {
    try {
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
      setExpenses(loadedExpenses);
      setItems(loadedItems);

      // Get cancelled item IDs
      const cancelledIds = new Set(loadedItems.filter(i => i.status === 'cancelled').map(i => i.id));

      // Load all item_participants
      const partsQ = query(collection(db, 'item_participants'));
      const partsRes = await getDocs(partsQ);
      const allPartsRaw = partsRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItemParticipant));
      const activeItemIds = new Set(loadedItems.filter(i => i.status === 'active').map(i => i.id));
      const allParts = allPartsRaw.filter(p => activeItemIds.has(p.item_id));

      // Build participant map
      const partMap: Record<string, ItemParticipant[]> = {};
      allParts.forEach(p => {
        if (!partMap[p.item_id]) partMap[p.item_id] = [];
        partMap[p.item_id].push(p);
      });

      // Build raw expenses for the engine
      const memberIds = loadedMembers.map(m => m.id);
      const rawExpenses: RawExpense[] = loadedExpenses.map(exp => {
        const participants = exp.item_id && partMap[exp.item_id]
          ? partMap[exp.item_id].map(p => ({ memberId: p.member_id, percentage: p.percentage ?? undefined }))
          : memberIds.map(id => ({ memberId: id })); // General expense: split among all
        return {
          id: exp.id,
          amount: Number(exp.amount),
          paidBy: exp.paid_by,
          splitType: exp.split_type as SplitType,
          itemId: exp.item_id,
          participants,
        };
      });

      // Run calculation engine
      const result = computeSettlements(rawExpenses, memberIds, cancelledIds);
      setBalances(result.balances);
      setSettlements(result.settlements);

      // Load existing settlement statuses from DB
      const settleQ = query(collection(db, 'settlements'), where('trip_id', '==', tripId));
      const settleRes = await getDocs(settleQ);
      const existingSettlements = settleRes.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));
      
      const statusMap: Record<string, 'pending' | 'paid'> = {};
      existingSettlements.forEach(s => {
        const key = `${s.from_member}-${s.to_member}`;
        statusMap[key] = s.status as 'pending' | 'paid';
      });
      setSettlementStatuses(statusMap);

      // Save settlements to DB (regenerate snapshot)
      try {
        for (const oldSettle of settleRes.docs) {
          await deleteDoc(oldSettle.ref);
        }
        
        if (result.settlements.length > 0) {
          const promises = result.settlements.map(s => {
            const key = `${s.from}-${s.to}`;
            const sRef = doc(collection(db, 'settlements'));
            return setDoc(sRef, {
              id: sRef.id,
              trip_id: tripId,
              from_member: s.from,
              to_member: s.to,
              amount: s.amount,
              status: statusMap[key] || 'pending',
              upi_link: generateUPILink(
                loadedMembers.find(m => m.id === s.to)?.display_name || '',
                s.amount
              ),
            });
          });
          await Promise.all(promises);
        }
      } catch (dbErr) {
        console.warn('Could not sync settlements to Firestore:', dbErr);
      }

      // Build category chart data
      const catMap: Record<string, number> = {};
      loadedExpenses.forEach(exp => {
        if (exp.item_id && cancelledIds.has(exp.item_id)) return;
        const item = loadedItems.find(i => i.id === exp.item_id);
        const cat = item?.type || 'other';
        catMap[cat] = (catMap[cat] || 0) + Number(exp.amount);
      });
      setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));

      // Build member spend data
      const memberPaid: Record<string, number> = {};
      const memberOwes: Record<string, number> = {};
      loadedMembers.forEach(m => {
        memberPaid[m.id] = 0;
        memberOwes[m.id] = 0;
      });
      loadedExpenses.forEach(exp => {
        if (exp.item_id && cancelledIds.has(exp.item_id)) return;
        memberPaid[exp.paid_by] = (memberPaid[exp.paid_by] || 0) + Number(exp.amount);
      });
      Object.entries(result.balances).forEach(([id, bal]) => {
        if (bal < 0) memberOwes[id] = Math.abs(bal);
      });
      setMemberSpendData(loadedMembers.map(m => ({
        name: m.display_name,
        paid: memberPaid[m.id] || 0,
        owes: memberOwes[m.id] || 0,
      })));
    } catch (err) {
      console.error('Failed to load group page data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function generateUPILink(payeeName: string, amount: number) {
    return `upi://pay?pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
  }

  const memberName = (id: string) => members.find(m => m.id === id)?.display_name || '?';
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={24} className="spin" style={{ color: 'var(--color-brand-500)' }} /></div>;
  }

  return (
    <div className="group-page">
      <style>{`
        .group-page { }
        .group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .group-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          padding: 1.25rem;
        }
        .stat-card .label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.375rem;
        }
        .stat-card .value {
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
        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 768px) {
          .charts-row { grid-template-columns: 1fr; }
        }
        .chart-card {
          padding: 1.5rem;
        }
        .chart-card h3 {
          font-size: 0.875rem;
          font-weight: 700;
          margin-bottom: 1rem;
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
        .settlement-amount {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-brand-400);
          white-space: nowrap;
        }
        .settlement-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
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
          cursor: pointer;
        }
        .settlement-upi:hover {
          background: rgba(34, 197, 94, 0.2);
        }
        .balance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .balance-card {
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .balance-card .name {
          font-weight: 600;
          font-size: 0.875rem;
        }
        .balance-card .amount {
          font-weight: 700;
          font-size: 1rem;
        }
        .balance-card .amount.positive {
          color: var(--color-success-500);
        }
        .balance-card .amount.negative {
          color: var(--color-danger-500);
        }
        .balance-card .amount.zero {
          color: var(--color-text-muted);
        }
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--color-text-secondary);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        .recharts-tooltip-wrapper .recharts-default-tooltip {
          background: var(--color-surface-100) !important;
          border: 1px solid var(--color-glass-border) !important;
          border-radius: 8px !important;
        }
      `}</style>

      <div className="group-header">
        <h2>👥 Group Dashboard</h2>
        <button className="btn-secondary" onClick={() => { setLoading(true); loadData(); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
          <RefreshCw size={14} /> Recalculate
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card glass-card animate-in">
          <div className="label">Total Expenses</div>
          <div className="value gradient-text">₹{totalExpenses.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card glass-card animate-in" style={{ animationDelay: '0.05s' }}>
          <div className="label">Members</div>
          <div className="value">{members.length}</div>
        </div>
        <div className="stat-card glass-card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="label">Settlements</div>
          <div className="value">{settlements.length}</div>
        </div>
        <div className="stat-card glass-card animate-in" style={{ animationDelay: '0.15s' }}>
          <div className="label">Per Person Avg</div>
          <div className="value">₹{members.length ? Math.round(totalExpenses / members.length).toLocaleString('en-IN') : 0}</div>
        </div>
      </div>

      {/* Charts */}
      {expenses.length > 0 && (
        <div className="charts-row">
          <div className="chart-card glass-card animate-in">
            <h3><PieChartIcon size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />Cost by Category</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No data</div>
            )}
          </div>

          <div className="chart-card glass-card animate-in" style={{ animationDelay: '0.05s' }}>
            <h3><TrendingUp size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />Member Contributions</h3>
            {memberSpendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={memberSpendData}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-glass-border)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--color-text-primary)' }}
                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <Legend />
                  <Bar dataKey="paid" fill="#5c7cfa" name="Paid" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="owes" fill="#fa5252" name="Owes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No data</div>
            )}
          </div>
        </div>
      )}

      {/* Balances */}
      <div className="section-title"><DollarSign size={18} /> Net Balances</div>
      <div className="balance-grid">
        {members.map((m, i) => {
          const bal = balances[m.id] || 0;
          return (
            <div key={m.id} className="balance-card glass-card animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="name">{m.display_name}</div>
              <div className={`amount ${bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : 'zero'}`}>
                {bal > 0.01 ? '+' : ''}₹{Math.abs(bal).toLocaleString('en-IN')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sum verification */}
      {members.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
          Balance sum: ₹{Object.values(balances).reduce((a, b) => a + b, 0).toFixed(2)} (should be 0.00)
        </div>
      )}

      {/* Settlements */}
      <div className="section-title"><ArrowRight size={18} /> Settlement Plan ({settlements.length} payment{settlements.length !== 1 ? 's' : ''})</div>
      {settlements.length === 0 ? (
        <div className="empty-state glass-card" style={{ marginBottom: '2rem' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--color-success-500)', marginBottom: '0.5rem' }} />
          <p>All settled up! No payments needed.</p>
        </div>
      ) : (
        <div className="settlement-list">
          {settlements.map((s, i) => {
            const key = `${s.from}-${s.to}`;
            const status = settlementStatuses[key] || 'pending';
            const upiLink = generateUPILink(memberName(s.to), s.amount);
            return (
              <div key={i} className="settlement-card glass-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="settlement-flow">
                  <span className="settlement-name">{memberName(s.from)}</span>
                  <ArrowRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="settlement-name">{memberName(s.to)}</span>
                </div>
                <span className="settlement-amount">₹{s.amount.toLocaleString('en-IN')}</span>
                <div className="settlement-status">
                  <span className={`badge ${status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                    {status === 'paid' ? <><CheckCircle2 size={10} /> Paid</> : <><Clock size={10} /> Pending</>}
                  </span>
                </div>
                <a href={upiLink} className="settlement-upi" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} /> UPI Pay
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
