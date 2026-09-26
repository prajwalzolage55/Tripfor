'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { dispatchExpenseNotification } from '@/lib/notifications';
import type { Expense, ItineraryItem, TripMember, ItemParticipant, SplitType } from '@/lib/types';
import {
  Plus, Receipt, DollarSign, Upload, Image, X, Loader2, Check, User, Tag, ChevronDown, Trash2,
} from 'lucide-react';

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Split Equally' },
  { value: 'flat_per_person', label: 'Flat Per Person' },
  { value: 'percentage', label: 'By Percentage' },
  { value: 'organizer_paid', label: 'Organizer Paid' },
];

export default function ExpensesPage() {
  const { user: authUser } = useAuth();
  const params = useParams();
  const tripId = params.id as string;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, ItemParticipant[]>>({});
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [formItemId, setFormItemId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaidBy, setFormPaidBy] = useState('');
  const [formSplitType, setFormSplitType] = useState<SplitType>('equal');
  const [formNote, setFormNote] = useState('');
  const [formReceipt, setFormReceipt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const expQ = query(collection(db, 'expenses'), where('trip_id', '==', tripId));
      const itemQ = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId), where('status', '==', 'active'));
      const memQ = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));

      const [expRes, itemRes, memRes] = await Promise.all([
        getDocs(expQ),
        getDocs(itemQ),
        getDocs(memQ),
      ]);

      const loadedExpenses = expRes.docs
        .map(d => ({ id: d.id, ...d.data() } as unknown as Expense))
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      const loadedItems = itemRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryItem));
      const loadedMembers = memRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));

      setExpenses(loadedExpenses);
      setItems(loadedItems);
      setMembers(loadedMembers);

      // Set current member using localStorage auth
      const storedUser = localStorage.getItem('gtl_user');
      if (storedUser && loadedMembers.length > 0) {
        const parsed = JSON.parse(storedUser);
        const me = loadedMembers.find(m => m.user_id === parsed.id);
        if (me) {
          setCurrentMemberId(me.id);
          if (!formPaidBy) setFormPaidBy(me.id);
        }
      }

      // Load participants for all items
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
    } catch (err) {
      console.error('Failed to load expenses page data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function uploadReceipt(file: File) {
    if (!file) return;
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormReceipt(reader.result as string);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read receipt image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      alert('Upload failed');
      setUploading(false);
    }
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const expRef = doc(collection(db, 'expenses'));
      const parsedAmount = parseFloat(formAmount);
      await setDoc(expRef, {
        id: expRef.id,
        trip_id: tripId,
        item_id: formItemId || null,
        amount: parsedAmount,
        paid_by: formPaidBy,
        split_type: formSplitType,
        receipt_url: formReceipt || null,
        note: formNote || null,
        created_at: new Date().toISOString()
      });

      // Dispatch push notification to trip members (e.g. ₹5,000 for dinner)
      const payer = members.find(m => m.id === formPaidBy);
      const payerName = payer?.display_name || authUser?.display_name || 'A group member';
      const payerUserId = payer?.user_id || authUser?.id || '';

      dispatchExpenseNotification({
        tripId,
        tripName: 'Trip',
        payerId: payerUserId,
        payerName,
        amount: parsedAmount,
        note: formNote || null,
      }).catch(err => console.warn('Push notification dispatch error:', err));

      setShowForm(false);
      setFormItemId('');
      setFormAmount('');
      setFormSplitType('equal');
      setFormNote('');
      setFormReceipt('');
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const memberName = (id: string) => members.find(m => m.id === id)?.display_name || '?';
  const itemLabel = (id: string | null) => {
    if (!id) return 'General';
    return items.find(i => i.id === id)?.label || 'Unknown Item';
  };

  // When an item is selected, auto-fill split type from the item's default
  function handleItemChange(itemId: string) {
    setFormItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (item) {
      setFormSplitType(item.default_split_type);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={24} className="spin" style={{ color: 'var(--color-brand-500)' }} /></div>;
  }

  return (
    <div className="exp-page">
      <style>{`
        .exp-page { }
        .exp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .exp-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
        }
        .exp-total {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .exp-total-card {
          padding: 1.25rem 1.5rem;
          flex: 1;
          min-width: 200px;
        }
        .exp-total-card .label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .exp-total-card .value {
          font-size: 1.5rem;
          font-weight: 800;
        }
        .exp-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .exp-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
        }
        .exp-row-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(92, 124, 250, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-brand-400);
          flex-shrink: 0;
        }
        .exp-row-body {
          flex: 1;
          min-width: 0;
        }
        .exp-row-title {
          font-size: 0.875rem;
          font-weight: 600;
        }
        .exp-row-sub {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .exp-row-amount {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-brand-400);
          white-space: nowrap;
        }
        .exp-row-actions {
          display: flex;
          gap: 0.25rem;
        }
        .exp-row-actions button {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .exp-row-actions button:hover {
          background: var(--color-surface-100);
          color: var(--color-danger-500);
        }
        .receipt-thumb {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          object-fit: cover;
          cursor: pointer;
          border: 1px solid var(--color-glass-border);
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
          max-width: 480px;
          padding: 2rem;
          max-height: 90vh;
          overflow-y: auto;
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
        .upload-area {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .upload-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-input);
          border: 1px dashed var(--color-glass-border);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .upload-btn:hover {
          border-color: var(--color-brand-500);
          color: var(--color-brand-400);
        }
        .receipt-preview {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid var(--color-glass-border);
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: var(--color-text-secondary);
        }
        .participant-hint {
          margin-top: 0.5rem;
          padding: 0.75rem;
          border-radius: var(--radius-input);
          background: rgba(92, 124, 250, 0.05);
          border: 1px solid rgba(92, 124, 250, 0.1);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }
        .participant-hint strong {
          color: var(--color-brand-400);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="exp-header">
        <h2>💰 Expenses</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setFormPaidBy(currentMemberId || ''); }}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="exp-total">
        <div className="exp-total-card glass-card">
          <div className="label">Total Expenses</div>
          <div className="value gradient-text">₹{expenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="exp-total-card glass-card">
          <div className="label">Transactions</div>
          <div className="value">{expenses.length}</div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state glass-card">
          <Receipt size={40} style={{ color: 'var(--color-brand-500)', marginBottom: '0.75rem' }} />
          <p>No expenses yet. Add expenses tied to itinerary items to start tracking.</p>
        </div>
      ) : (
        <div className="exp-list">
          {expenses.map((exp, i) => (
            <div key={exp.id} className="exp-row glass-card animate-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="exp-row-icon">
                <DollarSign size={18} />
              </div>
              <div className="exp-row-body">
                <div className="exp-row-title">{exp.note || itemLabel(exp.item_id)}</div>
                <div className="exp-row-sub">
                  <span><User size={11} /> Paid by {memberName(exp.paid_by)}</span>
                  <span>•</span>
                  <span><Tag size={11} /> {itemLabel(exp.item_id)}</span>
                  <span>•</span>
                  <span>{SPLIT_OPTIONS.find(s => s.value === exp.split_type)?.label}</span>
                </div>
              </div>
              <div className="exp-row-amount">₹{Number(exp.amount).toLocaleString('en-IN')}</div>
              {exp.receipt_url && (
                <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer">
                  <img src={exp.receipt_url} alt="Receipt" className="receipt-thumb" />
                </a>
              )}
              <div className="exp-row-actions">
                <button onClick={() => deleteExpense(exp.id)} title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card glass-card animate-in" onClick={e => e.stopPropagation()}>
            <h2>💰 Add Expense</h2>
            <form onSubmit={saveExpense} className="modal-form">
              <div className="form-group">
                <label>Itinerary Item</label>
                <select className="select-field" value={formItemId} onChange={e => handleItemChange(e.target.value)}>
                  <option value="">— General (not tied to an item) —</option>
                  {items.map(item => {
                    const dateStr = item.start_time
                      ? new Date(item.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                      : '';
                    const timeStr = item.start_time
                      ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const prefix = dateStr ? `${dateStr}${timeStr ? ` ${timeStr}` : ''} • ` : '';
                    return (
                      <option key={item.id} value={item.id}>
                        {prefix}{item.label} ({item.type})
                      </option>
                    );
                  })}
                </select>
              </div>

              {formItemId && participantsMap[formItemId] && (
                <div className="participant-hint">
                  <strong>Splitting among:</strong>{' '}
                  {participantsMap[formItemId].map(p => memberName(p.member_id)).join(', ')}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input type="number" className="input-field" placeholder="0.00" step="0.01" min="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Paid By *</label>
                  <select className="select-field" value={formPaidBy} onChange={e => setFormPaidBy(e.target.value)} required>
                    <option value="">Select...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Split Type</label>
                <select className="select-field" value={formSplitType} onChange={e => setFormSplitType(e.target.value as SplitType)}>
                  {SPLIT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Note</label>
                <input className="input-field" placeholder="What was this for?" value={formNote} onChange={e => setFormNote(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Receipt</label>
                <div className="upload-area">
                  <label className="upload-btn">
                    {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading...' : 'Upload Receipt'}
                    <input type="file" accept="image/*" hidden onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadReceipt(file);
                    }} />
                  </label>
                  {formReceipt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={formReceipt} alt="Receipt" className="receipt-preview" />
                      <button type="button" onClick={() => setFormReceipt('')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  Add Expense
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
