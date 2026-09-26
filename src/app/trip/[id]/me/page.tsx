'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  getEventStream,
  replayEvents,
  generateBalanceTrace,
  type BalanceTrace,
  type LedgerEvent,
  type TripState,
  computePersonalImpactProfile,
  type PersonalImpactProfile,
  type PrivacyScopeSettings,
} from '@/lib/ledger';
import type { Expense, ItineraryItem, TripMember, ItemParticipant } from '@/lib/types';
import {
  User,
  DollarSign,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plane,
  Hotel,
  Activity,
  Car,
  UtensilsCrossed,
  MoreHorizontal,
  Map as LucideMap,
  HelpCircle,
  ShieldCheck,
  X,
  Sparkles,
  Lock,
  Scale,
  Eye,
  EyeOff,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  QrCode,
  Share2,
  Shield,
  Layers,
  ChevronRight,
  FileText,
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

export default function PersonalImpactLensPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<TripMember | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);
  const [trace, setTrace] = useState<BalanceTrace[]>([]);

  // Active view tabs within Me page
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'cancellations' | 'refunds'>('overview');

  // "Why do I owe this?" modal
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [traceModalTab, setTraceModalTab] = useState<'tree' | 'chronological'>('tree');

  // QR Code Modal
  const [qrSettlement, setQrSettlement] = useState<{ name: string; amount: number; upiLink?: string } | null>(null);

  // Privacy Scope Settings (Local State persisted per traveler)
  const [privacySettings, setPrivacySettings] = useState<PrivacyScopeSettings>({
    shareTransactionsWithGroup: false,
    shareReceiptsWithGroup: false,
    maskIndividualLineItems: true,
  });
  const [privacyToast, setPrivacyToast] = useState<string | null>(null);

  // Load Privacy from LocalStorage
  useEffect(() => {
    if (currentMember) {
      const savedPrivacy = localStorage.getItem(`gtl_privacy_${tripId}_${currentMember.id}`);
      if (savedPrivacy) {
        try {
          setPrivacySettings(JSON.parse(savedPrivacy));
        } catch (e) {
          console.warn('Failed to parse privacy settings', e);
        }
      }
    }
  }, [tripId, currentMember]);

  const toggleShareTransactions = () => {
    if (!currentMember) return;
    const nextVal = !privacySettings.shareTransactionsWithGroup;
    const updated: PrivacyScopeSettings = {
      ...privacySettings,
      shareTransactionsWithGroup: nextVal,
      maskIndividualLineItems: !nextVal,
    };
    setPrivacySettings(updated);
    localStorage.setItem(`gtl_privacy_${tripId}_${currentMember.id}`, JSON.stringify(updated));
    setPrivacyToast(
      nextVal
        ? 'Visibility Updated: Your itemized transactions are now shared with group members.'
        : 'Privacy Shield Active: Your itemized transactions are now private (only aggregate totals visible).'
    );
    setTimeout(() => setPrivacyToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('gtl_user');
      const parsed = storedUser ? JSON.parse(storedUser) : null;

      const memQ = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));
      const memRes = await getDocs(memQ);
      const loadedMembers = memRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));
      setMembers(loadedMembers);

      let me = parsed ? loadedMembers.find(m => m.user_id === parsed.id) : null;
      if (!me && loadedMembers.length > 0) {
        me = loadedMembers[0]; // fallback to first member if viewing or testing
      }
      setCurrentMember(me || null);

      // Load immutable event stream and replay
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const derived = replayEvents(tripId, stream);
        setState(derived);

        if (me) {
          const traces = generateBalanceTrace(tripId, stream, me.id, derived.constitution);
          setTrace(traces);
        }
      }
    } catch (err) {
      console.error('Failed to load Personal Impact Lens data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Personal Impact Profile
  const profile: PersonalImpactProfile | null = useMemo(() => {
    if (!state || !currentMember) return null;
    return computePersonalImpactProfile(state, currentMember.id, privacySettings);
  }, [state, currentMember, privacySettings]);

  if (loading) {
    return (
      <div className="lens-loading">
        <Loader2 size={32} className="spin text-brand-500" />
        <p>Loading Personal Impact Lens...</p>
        <style jsx>{`
          .lens-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 1rem;
            color: var(--color-text-secondary);
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .spin { animation: spin 0.8s linear infinite; }
        `}</style>
      </div>
    );
  }

  if (!currentMember || !profile) {
    return (
      <div className="empty-member-container">
        <User size={40} className="text-slate-400" />
        <h2>Personal Impact Lens</h2>
        <p>No active member record found for this trip.</p>
        <style jsx>{`
          .empty-member-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 4rem 1.5rem;
            text-align: center;
            color: var(--color-text-secondary);
            gap: 0.75rem;
          }
        `}</style>
      </div>
    );
  }

  const {
    totalPaid,
    totalConsumed,
    netBalance,
    settlements,
    consumedByCategory,
    joinedBookings,
    skippedBookings,
    hierarchicalBreakdown,
    cancellationExposure,
    expectedRefunds,
    groupAggregates,
  } = profile;

  return (
    <div className="lens-page">
      {/* ─── Header & Persona Switcher ─── */}
      <div className="lens-header">
        <div className="lens-header-left">
          <div className="lens-badge">
            <ShieldCheck size={15} />
            <span>Feature 10 · Personal Impact Lens</span>
          </div>
          <h1 className="lens-title">Private Personal Impact Dashboard</h1>
          <p className="lens-subtitle">
            Your private slice of the trip. Showing exclusively your personal consumption, upfront contributions, pending cancellation risk, and vendor refund claims.
          </p>
        </div>

        {/* Persona Switcher (For Pair-Testing / Multi-Member Verification) */}
        {members.length > 1 && (
          <div className="persona-switcher">
            <span className="persona-label">Viewing as traveler:</span>
            <select
              value={currentMember.id}
              onChange={e => {
                const selected = members.find(m => m.id === e.target.value);
                if (selected) {
                  setCurrentMember(selected);
                  if (state && events.length > 0) {
                    setTrace(generateBalanceTrace(tripId, events, selected.id, state.constitution));
                  }
                }
              }}
              className="persona-select"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name} {m.id === currentMember.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ─── Privacy-Scoped Visibility Shield Banner ─── */}
      <div className="privacy-banner">
        <div className="privacy-banner-left">
          <div className={`privacy-icon-box ${privacySettings.shareTransactionsWithGroup ? 'shared' : 'shielded'}`}>
            {privacySettings.shareTransactionsWithGroup ? <Share2 size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <div className="privacy-title-row">
              <h3>
                {privacySettings.shareTransactionsWithGroup
                  ? 'Group Sharing Active (Opted-In)'
                  : 'Privacy-Scoped Visibility Shield Active'}
              </h3>
              <span className={`privacy-status-pill ${privacySettings.shareTransactionsWithGroup ? 'shared' : 'private'}`}>
                {privacySettings.shareTransactionsWithGroup ? 'Opted-In to Share' : 'Private (Zero Cross-Exposure)'}
              </span>
            </div>
            <p className="privacy-desc">
              {privacySettings.shareTransactionsWithGroup
                ? 'Your itemized receipts and personal transaction details are visible to other trip members.'
                : 'You see your own consumption and payments in full. Other travelers only see your aggregate net balance — never your private individual transactions or receipts.'}
            </p>
          </div>
        </div>

        <div className="privacy-banner-right">
          <button
            onClick={toggleShareTransactions}
            className={`privacy-toggle-btn ${privacySettings.shareTransactionsWithGroup ? 'btn-active' : ''}`}
          >
            {privacySettings.shareTransactionsWithGroup ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>
              {privacySettings.shareTransactionsWithGroup ? 'Make Transactions Private' : 'Opt-In to Share Transactions'}
            </span>
          </button>
        </div>
      </div>

      {privacyToast && (
        <div className="toast-message">
          <CheckCircle2 size={16} />
          <span>{privacyToast}</span>
        </div>
      )}

      {/* ─── Financial Summary Stats ─── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Upfront Paid</div>
          <div className="stat-value text-emerald-600">₹{totalPaid.toLocaleString('en-IN')}</div>
          <div className="stat-sub">Charged to your card / account</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Consumed Share</div>
          <div className="stat-value text-slate-800">₹{totalConsumed.toLocaleString('en-IN')}</div>
          <div className="stat-sub">Your portion of group services</div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-label">Net Balance</div>
          <div className={`stat-value ${netBalance > 0.01 ? 'text-emerald-600' : netBalance < -0.01 ? 'text-rose-600' : 'text-slate-600'}`}>
            {netBalance > 0.01 ? '+' : ''}₹{netBalance.toLocaleString('en-IN')}
          </div>
          <div className="stat-sub">
            {netBalance > 0.01 ? 'You are owed money' : netBalance < -0.01 ? 'You owe the group' : 'All settled up'}
          </div>

          <button
            onClick={() => setShowTraceModal(true)}
            className="why-owe-trigger"
          >
            <HelpCircle size={13} />
            <span>"Why do I owe this?"</span>
          </button>
        </div>

        <div className="stat-card">
          <div className="stat-label">Cancellation Exposure</div>
          <div className="stat-value text-amber-600">₹{cancellationExposure.totalPotentialExposure.toLocaleString('en-IN')}</div>
          <div className="stat-sub">{cancellationExposure.items.length} booking(s) with penalty risk</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Expected Vendor Refunds</div>
          <div className="stat-value text-cyan-600">₹{expectedRefunds.totalExpectedRefund.toLocaleString('en-IN')}</div>
          <div className="stat-sub">{expectedRefunds.items.length} pending refund claim(s)</div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="lens-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={16} />
          <span>Consumption vs. Paid</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => setActiveTab('itinerary')}
        >
          <LucideMap size={16} />
          <span>My Personal Itinerary ({joinedBookings.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'cancellations' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancellations')}
        >
          <AlertTriangle size={16} />
          <span>Cancellation Exposure ({cancellationExposure.items.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'refunds' ? 'active' : ''}`}
          onClick={() => setActiveTab('refunds')}
        >
          <Building2 size={16} />
          <span>Expected Refunds & Confidence ({expectedRefunds.items.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: OVERVIEW (CONSUMPTION VS PAID) ─── */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="split-columns">
            {/* Left: Category Consumption Breakdown */}
            <div className="content-card">
              <div className="card-header">
                <h3>What You Consumed by Category</h3>
                <span className="card-tag">Total: ₹{totalConsumed.toLocaleString('en-IN')}</span>
              </div>
              <p className="card-desc">
                Itemized breakdown of your personal share across all shared bookings and activities.
              </p>

              {consumedByCategory.length === 0 ? (
                <div className="empty-box">No consumed expenses recorded yet.</div>
              ) : (
                <div className="category-bars">
                  {consumedByCategory.map(cat => {
                    const Icon = typeIcon(cat.category);
                    return (
                      <div key={cat.category} className="category-row">
                        <div className="cat-header">
                          <div className="cat-name">
                            <div className="cat-icon">
                              <Icon size={14} />
                            </div>
                            <span className="font-semibold capitalize">{cat.category}</span>
                            <span className="text-xs text-slate-400">({cat.itemCount} items)</span>
                          </div>
                          <div className="cat-amount">
                            <strong>₹{cat.amount.toLocaleString('en-IN')}</strong>
                            <span className="cat-pct">{cat.percentage}%</span>
                          </div>
                        </div>
                        <div className="progress-bg">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Consumption vs Paid Balance Bar */}
              <div className="comparison-bar-box">
                <div className="comp-labels">
                  <span>Paid Upfront: ₹{totalPaid.toLocaleString('en-IN')}</span>
                  <span>Consumed: ₹{totalConsumed.toLocaleString('en-IN')}</span>
                </div>
                <div className="comp-bar">
                  <div
                    className="comp-paid"
                    style={{ width: `${Math.min(100, Math.round((totalPaid / (totalPaid + totalConsumed || 1)) * 100))}%` }}
                  />
                  <div
                    className="comp-consumed"
                    style={{ width: `${Math.min(100, Math.round((totalConsumed / (totalPaid + totalConsumed || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Personal Settlements & Outstanding Transfers */}
            <div className="content-card">
              <div className="card-header">
                <h3>Your Active Settlements</h3>
                <span className="card-tag">{settlements.length} Transfers</span>
              </div>
              <p className="card-desc">
                Minimum-transaction transfers to settle your net position cleanly with other travelers.
              </p>

              {settlements.length === 0 ? (
                <div className="empty-box success">
                  <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                  <p className="font-bold text-emerald-800">You are completely settled up!</p>
                  <p className="text-xs text-emerald-600">Zero outstanding debts or pending collections.</p>
                </div>
              ) : (
                <div className="settlement-cards">
                  {settlements.map((s, idx) => (
                    <div key={idx} className={`settle-card ${s.iOwe ? 'owe' : 'receive'}`}>
                      <div className="settle-top">
                        <span className={`direction-pill ${s.iOwe ? 'owe' : 'receive'}`}>
                          {s.iOwe ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          <span>{s.iOwe ? 'You Owe' : 'You Receive'}</span>
                        </span>
                        <div className="settle-amount">₹{s.amount.toLocaleString('en-IN')}</div>
                      </div>

                      <div className="settle-details">
                        {s.iOwe ? (
                          <span>Transfer to <strong>{s.toName}</strong></span>
                        ) : (
                          <span>Collect from <strong>{s.fromName}</strong></span>
                        )}
                      </div>

                      {s.iOwe && s.upiLink && (
                        <div className="settle-actions">
                          <a
                            href={s.upiLink}
                            className="upi-pay-btn"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={13} />
                            <span>Pay via UPI</span>
                          </a>
                          <button
                            className="qr-icon-btn"
                            onClick={() => setQrSettlement({ name: s.toName, amount: s.amount, upiLink: s.upiLink })}
                            title="Show UPI QR Code"
                          >
                            <QrCode size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Group Aggregates Privacy Notice */}
              <div className="group-aggregate-box">
                <div className="agg-header">
                  <Lock size={14} className="text-slate-500" />
                  <h4>Group Totals (Privacy-Preserving Aggregate)</h4>
                </div>
                <div className="agg-grid">
                  <div className="agg-stat">
                    <span>Group Spend:</span>
                    <strong>₹{groupAggregates.totalGroupSpend.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="agg-stat">
                    <span>Total Bookings:</span>
                    <strong>{groupAggregates.totalGroupBookings} items</strong>
                  </div>
                  <div className="agg-stat">
                    <span>Group Members:</span>
                    <strong>{groupAggregates.totalGroupMembers} travelers</strong>
                  </div>
                </div>
                <p className="agg-note">
                  * Other travelers' individual item splits remain masked under privacy scope.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PERSONALIZED ITINERARY ─── */}
      {activeTab === 'itinerary' && (
        <div className="tab-content">
          <div className="content-card">
            <div className="card-header">
              <div>
                <h3>Your Personal Itinerary Schedule</h3>
                <p className="card-desc">
                  Activities and bookings you joined vs. opted out of. You only pay for items you participate in.
                </p>
              </div>
              <span className="card-tag">{joinedBookings.length} Joined · {skippedBookings.length} Opted Out</span>
            </div>

            {joinedBookings.length === 0 ? (
              <div className="empty-box">You haven't joined any itinerary bookings yet.</div>
            ) : (
              <div className="itinerary-list">
                {joinedBookings.map(item => {
                  const Icon = typeIcon(item.type);
                  return (
                    <div key={item.id} className="itinerary-item-row joined">
                      <div className="item-icon-box">
                        <Icon size={18} />
                      </div>
                      <div className="item-main">
                        <div className="item-title-row">
                          <span className="item-title">{item.label}</span>
                          <span className="item-status-pill joined">Joined</span>
                          {item.status === 'cancelled' && (
                            <span className="item-status-pill cancelled">Cancelled</span>
                          )}
                        </div>
                        <div className="item-meta">
                          {item.vendorName && <span>Vendor: {item.vendorName} · </span>}
                          {item.startTime && (
                            <span>
                              {new Date(item.startTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="item-financials">
                        <div className="item-share-cost">₹{item.myShare.toLocaleString('en-IN')}</div>
                        <span className="item-share-label">Your personal share</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Skipped Bookings */}
            {skippedBookings.length > 0 && (
              <div className="skipped-section">
                <h4 className="skipped-header">
                  Opted-Out / Skipped Bookings ({skippedBookings.length})
                </h4>
                <div className="itinerary-list">
                  {skippedBookings.map(item => {
                    const Icon = typeIcon(item.type);
                    return (
                      <div key={item.id} className="itinerary-item-row skipped">
                        <div className="item-icon-box skipped">
                          <Icon size={18} />
                        </div>
                        <div className="item-main">
                          <div className="item-title-row">
                            <span className="item-title">{item.label}</span>
                            <span className="item-status-pill skipped">Opted Out (₹0 Charged)</span>
                          </div>
                          <div className="item-meta">
                            <span>Exempted from cost under Fairness Constitution Rule 1 & Rule 3</span>
                          </div>
                        </div>
                        <div className="item-financials">
                          <div className="item-share-cost text-slate-400">₹0</div>
                          <span className="item-share-label">Cost: ₹0 (Protected)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CANCELLATION EXPOSURE ─── */}
      {activeTab === 'cancellations' && (
        <div className="tab-content">
          <div className="content-card">
            <div className="card-header">
              <div>
                <h3>Potential Exposure from Pending Cancellations</h3>
                <p className="card-desc">
                  Under the Fairness Constitution, voluntary and group cancellations have explicit liability rules. This is your personal financial exposure if bookings cancel.
                </p>
              </div>
              <div className="exposure-total-badge">
                <span>Maximum Potential Loss:</span>
                <strong className="text-amber-600">₹{cancellationExposure.totalPotentialExposure.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {cancellationExposure.items.length === 0 ? (
              <div className="empty-box success">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                <p className="font-bold text-emerald-800">Zero Cancellation Exposure!</p>
                <p className="text-xs text-emerald-600">All your active bookings have 100% refundable policies or no pending penalties.</p>
              </div>
            ) : (
              <div className="exposure-grid">
                {cancellationExposure.items.map(item => (
                  <div key={item.bookingId} className={`exposure-card risk-${item.riskLevel}`}>
                    <div className="exposure-header">
                      <div>
                        <h4 className="exposure-title">{item.label}</h4>
                        <span className="exposure-policy">{item.cancellationPolicy}</span>
                      </div>
                      <span className={`risk-badge risk-${item.riskLevel}`}>
                        {item.riskLevel.toUpperCase()} RISK
                      </span>
                    </div>

                    <div className="exposure-amounts">
                      <div>
                        <span className="exp-label">Your Booking Share:</span>
                        <div className="exp-val">₹{item.myShare.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="text-right">
                        <span className="exp-label">Potential Personal Loss:</span>
                        <div className="exp-loss">₹{item.potentialLoss.toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    <div className="exposure-rule">
                      <Scale size={13} />
                      <span>{item.governingRule}</span>
                    </div>

                    <p className="exposure-reason">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: EXPECTED REFUNDS & CONFIDENCE ─── */}
      {activeTab === 'refunds' && (
        <div className="tab-content">
          <div className="content-card">
            <div className="card-header">
              <div>
                <h3>Expected Vendor Refunds & Confidence Level</h3>
                <p className="card-desc">
                  Under <strong>Rule 7 (Refund to Original Funder)</strong>, vendor refunds return economically to the travelers who funded them, not merely to the cardholder.
                </p>
              </div>
              <div className="refund-total-badge">
                <span>Total Expected Refund:</span>
                <strong className="text-cyan-700">₹{expectedRefunds.totalExpectedRefund.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {expectedRefunds.items.length === 0 ? (
              <div className="empty-box">
                <Building2 size={32} className="text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No Pending Vendor Refunds</p>
                <p className="text-xs text-slate-500">There are currently no outstanding vendor refund claims for your bookings.</p>
              </div>
            ) : (
              <div className="refund-grid">
                {expectedRefunds.items.map(item => (
                  <div key={item.id} className="refund-card">
                    <div className="refund-card-top">
                      <div>
                        <h4 className="refund-booking-label">{item.label}</h4>
                        <span className="refund-vendor">Vendor: {item.vendorName}</span>
                      </div>
                      <div className="refund-amount-box">
                        <span className="ref-entitlement-label">Your Entitlement:</span>
                        <span className="ref-entitlement-amt">₹{item.myEntitlement.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Confidence Meter */}
                    <div className="confidence-box">
                      <div className="confidence-header">
                        <span className="conf-label">Confidence Level:</span>
                        <span className={`conf-badge conf-${item.confidenceLevel}`}>
                          {item.confidenceLevel.toUpperCase()} ({item.confidencePercent}%)
                        </span>
                      </div>
                      <div className="confidence-bar-bg">
                        <div
                          className={`confidence-bar-fill conf-${item.confidenceLevel}`}
                          style={{ width: `${item.confidencePercent}%` }}
                        />
                      </div>
                      <p className="conf-rationale">{item.confidenceRationale}</p>
                    </div>

                    <div className="refund-footer">
                      <div className="refund-rule">
                        <ShieldCheck size={13} />
                        <span>{item.governingRule}</span>
                      </div>
                      {item.expectedDate && (
                        <div className="refund-date">
                          <Clock size={12} />
                          <span>Timeline: {item.expectedDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: "WHY DO I OWE THIS?" (Section 10 Spec Matcher) ─── */}
      {showTraceModal && (
        <div className="modal-backdrop" onClick={() => setShowTraceModal(false)}>
          <div className="trace-modal-container" onClick={e => e.stopPropagation()}>
            <div className="trace-modal-header">
              <div>
                <div className="trace-badge">
                  <ShieldCheck size={14} />
                  <span>Section 10 · "Why Do I Owe This?" Personal Lens</span>
                </div>
                <h3>
                  Decomposition for {currentMember.display_name} ({netBalance >= 0 ? '+' : ''}₹{netBalance.toLocaleString('en-IN')})
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowTraceModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs">
              <button
                className={`modal-tab-btn ${traceModalTab === 'tree' ? 'active' : ''}`}
                onClick={() => setTraceModalTab('tree')}
              >
                <Layers size={14} />
                <span>Hierarchical Tree Breakdown (Spec Format)</span>
              </button>
              <button
                className={`modal-tab-btn ${traceModalTab === 'chronological' ? 'active' : ''}`}
                onClick={() => setTraceModalTab('chronological')}
              >
                <Clock size={14} />
                <span>Chronological Event Stream Replay ({trace.length} Events)</span>
              </button>
            </div>

            <div className="trace-modal-body">
              {/* TAB A: Hierarchical Tree Breakdown (Matching Section 10 Specification Exactly) */}
              {traceModalTab === 'tree' && (
                <div className="tree-breakdown-container">
                  <div className="tree-intro">
                    <p>
                      Every expense is mathematically decomposed into sub-components, occupancy allocations, and refund credits with cited rules:
                    </p>
                  </div>

                  {hierarchicalBreakdown.length === 0 ? (
                    <div className="empty-box">No line-item decomposition found for this traveler.</div>
                  ) : (
                    <div className="tree-list">
                      {hierarchicalBreakdown.map((item, idx) => (
                        <div key={idx} className="tree-item-card">
                          <div className="tree-item-header">
                            <div className="tree-item-title">
                              <span className="tree-cat-tag capitalize">{item.category}</span>
                              <strong>{item.itemLabel}</strong>
                            </div>
                            <div className="tree-item-total">
                              <span className="text-xs text-slate-400">Your Share:</span>
                              <strong>₹{item.myTotalShare.toLocaleString('en-IN')}</strong>
                            </div>
                          </div>

                          {/* Tree Lines */}
                          <div className="tree-lines">
                            {item.lines.map((line, lIdx) => (
                              <div key={lIdx} className="tree-line">
                                <div className="tree-branch">
                                  {lIdx === item.lines.length - 1 ? '└──' : '├──'}
                                </div>
                                <div className="tree-line-main">
                                  <span className="tree-line-label">{line.label}</span>
                                  {line.citation && (
                                    <span className="tree-line-citation">{line.citation}</span>
                                  )}
                                </div>
                                <div className={`tree-line-amt ${line.amount < 0 ? 'credit' : ''}`}>
                                  {line.amount < 0 ? `-₹${Math.abs(line.amount).toLocaleString('en-IN')}` : `₹${line.amount.toLocaleString('en-IN')}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary Mathematical Proof */}
                  <div className="tree-summary-card">
                    <div className="summary-title">Mathematical Net Balance Synthesis:</div>
                    <div className="summary-row">
                      <span>Total Fronted / Paid Out:</span>
                      <strong className="text-emerald-600">+₹{totalPaid.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Total Consumed Shares:</span>
                      <strong className="text-rose-600">-₹{totalConsumed.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="summary-row total">
                      <span>Your Net Balance:</span>
                      <strong className={netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {netBalance >= 0 ? '+' : ''}₹{netBalance.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: Chronological Event Stream Replay */}
              {traceModalTab === 'chronological' && (
                <div className="chronological-trace-list">
                  {trace.length === 0 ? (
                    <div className="empty-box">No event traces recorded yet.</div>
                  ) : (
                    trace.map((item, idx) => (
                      <div key={idx} className="trace-event-card">
                        <div className="trace-event-top">
                          <div className="trace-event-meta">
                            <span className="trace-type-pill">{item.eventType}</span>
                            <span className="trace-time">
                              {item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="trace-event-impact">
                            <span className={`impact-amt ${item.impact > 0 ? 'positive' : item.impact < 0 ? 'negative' : ''}`}>
                              {item.impact > 0 ? `+₹${item.impact.toLocaleString('en-IN')}` : item.impact < 0 ? `-₹${Math.abs(item.impact).toLocaleString('en-IN')}` : '₹0'}
                            </span>
                            <span className="running-bal">Run: ₹{item.runningBalance.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div className="trace-desc">{item.description}</div>

                        {item.applicableRule && (
                          <div className="trace-rule-callout">
                            <Scale size={12} />
                            <span>
                              <strong>Rule {item.applicableRule.ruleNumber} ({item.applicableRule.ruleName}):</strong> {item.applicableRule.citation}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: QR CODE ─── */}
      {qrSettlement && (
        <div className="modal-backdrop" onClick={() => setQrSettlement(null)}>
          <div className="qr-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header-simple">
              <h3>Instant UPI QR Payment</h3>
              <button className="modal-close-btn" onClick={() => setQrSettlement(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="qr-body">
              <div className="qr-code-img">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrSettlement.upiLink || '')}`}
                  alt="UPI QR Code"
                  width={200}
                  height={200}
                />
              </div>
              <div className="qr-amt">₹{qrSettlement.amount.toLocaleString('en-IN')}</div>
              <div className="qr-sub">Transfer to <strong>{qrSettlement.name}</strong></div>
              <p className="qr-hint">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page CSS ─── */}
      <style jsx>{`
        .lens-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem 5rem;
          color: var(--color-text-primary);
        }

        .lens-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
          margin-bottom: 1.75rem;
        }

        .lens-header-left {
          flex: 1;
          min-width: 280px;
        }

        .lens-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #4f46e5;
          font-size: 0.825rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .lens-title {
          font-size: 2.15rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 0.35rem;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .lens-subtitle {
          font-size: 1rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .persona-switcher {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          background: var(--color-surface-card);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--color-glass-border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .persona-label {
          font-size: 0.725rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }

        .persona-select {
          padding: 0.45rem 0.75rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-weight: 600;
          font-size: 0.875rem;
          background: white;
          color: #1e293b;
        }

        /* Privacy Banner */
        .privacy-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          border-radius: 14px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          margin-bottom: 2rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
        }

        .privacy-banner-left {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex: 1;
          min-width: 280px;
        }

        .privacy-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .privacy-icon-box.shielded {
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
        }

        .privacy-icon-box.shared {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .privacy-title-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-bottom: 0.25rem;
        }

        .privacy-title-row h3 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .privacy-status-pill {
          font-size: 0.725rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
        }

        .privacy-status-pill.private {
          background: #e0e7ff;
          color: #4338ca;
        }

        .privacy-status-pill.shared {
          background: #d1fae5;
          color: #065f46;
        }

        .privacy-desc {
          font-size: 0.825rem;
          color: var(--color-text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        .privacy-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .privacy-toggle-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .privacy-toggle-btn.btn-active {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #4338ca;
        }

        .toast-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          border-radius: 10px;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 14px;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
        }

        .stat-card.highlight {
          border-color: rgba(99, 102, 241, 0.35);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.01) 100%);
        }

        .stat-label {
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.35rem;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
          line-height: 1.2;
        }

        .stat-sub {
          font-size: 0.775rem;
          color: var(--color-text-tertiary);
          margin-bottom: 0.5rem;
        }

        .why-owe-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: auto;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          color: #4f46e5;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .why-owe-trigger:hover {
          background: rgba(99, 102, 241, 0.22);
          transform: translateY(-1px);
        }

        /* Tabs */
        .lens-tabs {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid var(--color-glass-border);
          padding-bottom: 0.5rem;
          margin-bottom: 1.75rem;
          overflow-x: auto;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.15rem;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          background: var(--color-surface-100);
          color: var(--color-text-primary);
        }

        .tab-btn.active {
          background: var(--color-surface-200);
          border-color: var(--color-glass-border);
          color: var(--color-text-primary);
        }

        /* Split Columns */
        .split-columns {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 1.5rem;
        }

        .content-card {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.03);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .card-header h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }

        .card-tag {
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          background: var(--color-surface-100);
          color: var(--color-text-secondary);
        }

        .card-desc {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-bottom: 1.5rem;
          line-height: 1.45;
        }

        .category-bars {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .category-row {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .cat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .cat-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cat-icon {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #475569;
        }

        .cat-amount {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cat-pct {
          font-size: 0.75rem;
          color: #64748b;
        }

        .progress-bg {
          height: 7px;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
          border-radius: 9999px;
        }

        .comparison-bar-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
        }

        .comp-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.45rem;
        }

        .comp-bar {
          display: flex;
          height: 10px;
          border-radius: 9999px;
          overflow: hidden;
          background: #e2e8f0;
        }

        .comp-paid {
          background: #10b981;
        }

        .comp-consumed {
          background: #6366f1;
        }

        /* Settlements */
        .settlement-cards {
          display: grid;
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }

        .settle-card {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-100);
        }

        .settle-card.owe {
          border-left: 4px solid #ef4444;
        }

        .settle-card.receive {
          border-left: 4px solid #10b981;
        }

        .settle-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.45rem;
        }

        .direction-pill {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.725rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }

        .direction-pill.owe {
          background: #fee2e2;
          color: #dc2626;
        }

        .direction-pill.receive {
          background: #d1fae5;
          color: #059669;
        }

        .settle-amount {
          font-size: 1.25rem;
          font-weight: 800;
        }

        .settle-details {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.75rem;
        }

        .settle-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .upi-pay-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.45rem 0.85rem;
          border-radius: 6px;
          background: #10b981;
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          text-decoration: none;
        }

        .qr-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #475569;
          cursor: pointer;
        }

        /* Group Aggregates Box */
        .group-aggregate-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
        }

        .agg-header {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 0.75rem;
        }

        .agg-header h4 {
          font-size: 0.85rem;
          font-weight: 700;
          color: #334155;
          margin: 0;
        }

        .agg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.65rem;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }

        .agg-stat {
          display: flex;
          flex-direction: column;
          color: #475569;
        }

        .agg-stat strong {
          color: #0f172a;
          font-size: 0.95rem;
        }

        .agg-note {
          font-size: 0.725rem;
          color: #94a3b8;
          margin: 0;
          font-style: italic;
        }

        /* Itinerary List */
        .itinerary-list {
          display: grid;
          gap: 0.75rem;
        }

        .itinerary-item-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          background: var(--color-surface-100);
          border: 1px solid var(--color-glass-border);
        }

        .itinerary-item-row.skipped {
          opacity: 0.6;
          background: #f8fafc;
        }

        .item-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #eef2ff;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .item-icon-box.skipped {
          background: #f1f5f9;
          color: #94a3b8;
        }

        .item-main {
          flex: 1;
        }

        .item-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.2rem;
        }

        .item-title {
          font-weight: 700;
          font-size: 0.95rem;
        }

        .item-status-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .item-status-pill.joined { background: #dcfce7; color: #15803d; }
        .item-status-pill.skipped { background: #f1f5f9; color: #64748b; }
        .item-status-pill.cancelled { background: #fee2e2; color: #b91c1c; }

        .item-meta {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .item-financials {
          text-align: right;
        }

        .item-share-cost {
          font-size: 1.15rem;
          font-weight: 800;
        }

        .item-share-label {
          font-size: 0.725rem;
          color: var(--color-text-tertiary);
        }

        .skipped-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px dashed var(--color-glass-border);
        }

        .skipped-header {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          margin-bottom: 0.75rem;
        }

        /* Cancellation Exposure */
        .exposure-total-badge, .refund-total-badge {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.85rem;
          border-radius: 8px;
          background: var(--color-surface-100);
          font-size: 0.85rem;
        }

        .exposure-grid, .refund-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.25rem;
        }

        .exposure-card {
          padding: 1.25rem;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .exposure-card.risk-high { border-left: 4px solid #ef4444; }
        .exposure-card.risk-medium { border-left: 4px solid #f59e0b; }
        .exposure-card.risk-low { border-left: 4px solid #3b82f6; }

        .exposure-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .exposure-title {
          font-size: 1rem;
          font-weight: 700;
          margin: 0 0 0.15rem;
        }

        .exposure-policy {
          font-size: 0.75rem;
          color: #64748b;
        }

        .risk-badge {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        .risk-badge.risk-high { background: #fee2e2; color: #dc2626; }
        .risk-badge.risk-medium { background: #fef3c7; color: #d97706; }
        .risk-badge.risk-low { background: #dbeafe; color: #2563eb; }

        .exposure-amounts {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 0.75rem;
        }

        .exp-label {
          font-size: 0.725rem;
          color: #64748b;
        }

        .exp-val {
          font-size: 1rem;
          font-weight: 700;
        }

        .exp-loss {
          font-size: 1rem;
          font-weight: 800;
          color: #dc2626;
        }

        .exposure-rule {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #4f46e5;
          margin-bottom: 0.5rem;
        }

        .exposure-reason {
          font-size: 0.8rem;
          color: #475569;
          margin: 0;
          line-height: 1.4;
        }

        /* Expected Refunds */
        .refund-card {
          padding: 1.25rem;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .refund-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .refund-booking-label {
          font-size: 1rem;
          font-weight: 700;
          margin: 0 0 0.15rem;
        }

        .refund-vendor {
          font-size: 0.775rem;
          color: #64748b;
        }

        .refund-amount-box {
          text-align: right;
        }

        .ref-entitlement-label {
          font-size: 0.7rem;
          color: #64748b;
          display: block;
        }

        .ref-entitlement-amt {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0891b2;
        }

        .confidence-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.85rem;
          margin-bottom: 0.85rem;
        }

        .confidence-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.4rem;
        }

        .conf-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
        }

        .conf-badge {
          font-size: 0.725rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }

        .conf-badge.conf-high { background: #d1fae5; color: #047857; }
        .conf-badge.conf-medium { background: #fef3c7; color: #b45309; }
        .conf-badge.conf-low { background: #fee2e2; color: #be123c; }

        .confidence-bar-bg {
          height: 6px;
          background: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .confidence-bar-fill {
          height: 100%;
          border-radius: 9999px;
        }

        .confidence-bar-fill.conf-high { background: #10b981; }
        .confidence-bar-fill.conf-medium { background: #f59e0b; }
        .confidence-bar-fill.conf-low { background: #f43f5e; }

        .conf-rationale {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
          line-height: 1.4;
        }

        .refund-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.725rem;
        }

        .refund-rule {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: #4f46e5;
          font-weight: 600;
        }

        .refund-date {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: #64748b;
        }

        /* ─── MODAL STYLES ─── */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .trace-modal-container {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 720px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .trace-modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .trace-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.725rem;
          font-weight: 700;
          color: #4f46e5;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .trace-modal-header h3 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          cursor: pointer;
        }

        .modal-tabs {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .modal-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          font-size: 0.85rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .modal-tab-btn.active {
          color: #4f46e5;
          background: white;
          border-bottom-color: #4f46e5;
        }

        .trace-modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        /* Tree Styles (Spec Matcher) */
        .tree-intro {
          font-size: 0.85rem;
          color: #475569;
          margin-bottom: 1rem;
        }

        .tree-list {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .tree-item-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          background: #fafafa;
        }

        .tree-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed #e2e8f0;
        }

        .tree-cat-tag {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          background: #e2e8f0;
          color: #334155;
          margin-right: 0.5rem;
        }

        .tree-lines {
          display: grid;
          gap: 0.5rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .tree-line {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .tree-branch {
          color: #94a3b8;
          font-weight: 700;
        }

        .tree-line-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .tree-line-label {
          color: #1e293b;
        }

        .tree-line-citation {
          font-size: 0.7rem;
          color: #6366f1;
          font-family: inherit;
        }

        .tree-line-amt {
          font-weight: 700;
          color: #0f172a;
        }

        .tree-line-amt.credit {
          color: #16a34a;
        }

        .tree-summary-card {
          background: #f1f5f9;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: grid;
          gap: 0.45rem;
          font-size: 0.875rem;
        }

        .summary-title {
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.25rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
        }

        .summary-row.total {
          padding-top: 0.5rem;
          border-top: 1px solid #cbd5e1;
          font-size: 1rem;
          font-weight: 800;
        }

        /* Chronological Trace */
        .chronological-trace-list {
          display: grid;
          gap: 0.75rem;
        }

        .trace-event-card {
          padding: 0.85rem 1rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fafafa;
        }

        .trace-event-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.35rem;
        }

        .trace-event-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .trace-type-pill {
          font-size: 0.675rem;
          font-family: monospace;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          background: #e2e8f0;
          color: #334155;
        }

        .trace-time {
          font-size: 0.725rem;
          color: #94a3b8;
        }

        .trace-event-impact {
          text-align: right;
        }

        .impact-amt {
          font-size: 0.9rem;
          font-weight: 800;
          font-family: monospace;
        }

        .impact-amt.positive { color: #16a34a; }
        .impact-amt.negative { color: #dc2626; }

        .running-bal {
          display: block;
          font-size: 0.7rem;
          color: #64748b;
        }

        .trace-desc {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.35rem;
        }

        .trace-rule-callout {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: #3730a3;
          background: #eef2ff;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
        }

        /* QR Modal */
        .qr-modal-card {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 360px;
          padding: 1.5rem;
          text-align: center;
        }

        .modal-header-simple {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }

        .modal-header-simple h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0;
        }

        .qr-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .qr-code-img {
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: white;
        }

        .qr-amt {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
        }

        .qr-sub {
          font-size: 0.85rem;
          color: #475569;
        }

        .qr-hint {
          font-size: 0.75rem;
          color: #94a3b8;
          margin: 0;
        }

        .empty-box {
          text-align: center;
          padding: 2.5rem;
          color: var(--color-text-secondary);
          border: 1px dashed var(--color-glass-border);
          border-radius: 12px;
          font-size: 0.875rem;
        }

        .empty-box.success {
          background: #ecfdf5;
          border-color: #a7f3d0;
          border-style: solid;
        }
      `}</style>
    </div>
  );
}
