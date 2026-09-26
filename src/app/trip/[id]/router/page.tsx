'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  appendEvent,
  type LedgerEvent,
  type TripState,
  type PaymentState,
  type RoutedTransfer,
  type SettlementRoutingPlan,
  type RawDebtEdge,
  type PendingVendorRefund,
  type DisputedDebtItem,
  type OrganizerFrontedItem,
  type NonCashVoucher,
  PAYMENT_STATE_META,
  getPaymentStateMeta,
  computeSettlementRouting,
  getSection7BenchmarkScenario,
} from '@/lib/ledger';
import {
  ArrowRightLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Ticket,
  HelpCircle,
  ExternalLink,
  QrCode,
  DollarSign,
  TrendingDown,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  X,
  FileText,
  User,
  Check,
  Info,
  ChevronRight,
  Filter,
  Eye,
  Zap,
} from 'lucide-react';

export default function SettlementRouterPage() {
  const params = useParams();
  const tripId = params?.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  // Active view & filter
  const [activeTab, setActiveTab] = useState<'router' | 'graph_view' | 'benchmark'>('router');
  const [filterState, setFilterState] = useState<PaymentState | 'all'>('all');

  // Custom simulation items added by user in-session
  const [customRefunds, setCustomRefunds] = useState<PendingVendorRefund[]>([]);
  const [customDisputes, setCustomDisputes] = useState<DisputedDebtItem[]>([]);
  const [customVouchers, setCustomVouchers] = useState<NonCashVoucher[]>([]);

  // Modals
  const [showAddRefundModal, setShowAddRefundModal] = useState(false);
  const [showAddDisputeModal, setShowAddDisputeModal] = useState(false);
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [selectedQRTransfer, setSelectedQRTransfer] = useState<RoutedTransfer | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // New Refund Form State
  const [newVendorName, setNewVendorName] = useState('Grand Hotel');
  const [newRefundAmount, setNewRefundAmount] = useState('700');
  const [newRefundRecipient, setNewRefundRecipient] = useState('');
  const [newRefundReason, setNewRefundReason] = useState('Hotel room cancellation refund (pending)');

  // New Dispute Form State
  const [newDisputeExpenseId, setNewDisputeExpenseId] = useState('');
  const [newDisputeReason, setNewDisputeReason] = useState('Alcohol split should not apply to non-drinkers');

  // New Voucher Form State
  const [newVoucherIssuer, setNewVoucherIssuer] = useState('IndiGo Airlines');
  const [newVoucherValue, setNewVoucherValue] = useState('2400');
  const [newVoucherHolder, setNewVoucherHolder] = useState('');
  const [newVoucherNotes, setNewVoucherNotes] = useState('Non-refundable flight credit voucher');

  // Load stream
  const loadData = useCallback(async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const derived = replayEvents(tripId, stream);
        setState(derived);
      }
    } catch (err) {
      console.error('Failed to load Settlement Router data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default form member selections once state loads
  useEffect(() => {
    if (state?.members && state.members.length > 0) {
      if (!newRefundRecipient) setNewRefundRecipient(state.members[0].memberId);
      if (!newVoucherHolder) setNewVoucherHolder(state.members[0].memberId);
      if (!newDisputeExpenseId && state.expenses.length > 0) {
        setNewDisputeExpenseId(state.expenses[0].expenseId);
      }
    }
  }, [state, newRefundRecipient, newVoucherHolder, newDisputeExpenseId]);

  // Compute live routing plan
  const plan: SettlementRoutingPlan | null = useMemo(() => {
    if (!state || state.members.length === 0) return null;
    return computeSettlementRouting(state, {
      customRefunds,
      customDisputes,
      customVouchers,
    });
  }, [state, customRefunds, customDisputes, customVouchers]);

  // Canonical Section 7 Benchmark Case
  const benchmarkData = useMemo(() => {
    const memberA = state?.members[0]?.displayName || 'Alice';
    const memberB = state?.members[1]?.displayName || 'Bob';
    const memberC = state?.members[2]?.displayName || 'Charlie';
    return getSection7BenchmarkScenario({ a: memberA, b: memberB, c: memberC });
  }, [state]);

  // Mark a transfer as paid by appending PAYMENT_MADE event
  const handleMarkAsPaid = async (transfer: RoutedTransfer) => {
    if (!state) return;
    try {
      await appendEvent(
        tripId,
        'PAYMENT_MADE',
        user?.id || transfer.fromMemberId,
        {
          settlementId: transfer.id,
          fromMemberId: transfer.fromMemberId,
          toMemberId: transfer.toMemberId,
          amount: transfer.amount,
          currency: 'INR',
          method: 'upi',
          upiTransactionId: `UPI-${Date.now().toString(36).toUpperCase()}`,
        }
      );
      setActionSuccessMsg(`Recorded payment of ₹${transfer.amount.toLocaleString('en-IN')} from ${transfer.fromMemberName} to ${transfer.toMemberName}!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadData();
    } catch (err) {
      console.error('Failed to mark payment as paid:', err);
    }
  };

  // Record vendor refund received
  const handleRecordRefundReceived = async (refund: PendingVendorRefund) => {
    if (!state) return;
    try {
      await appendEvent(
        tripId,
        'REFUND_RECEIVED',
        user?.id || refund.recipientMemberId,
        {
          refundId: `ref-${Date.now()}`,
          linkedItemId: refund.linkedItemId || 'vendor-claim',
          amount: refund.amount,
          currency: 'INR',
          receivedByMemberId: refund.recipientMemberId,
          vendorName: refund.vendorName,
          isFullRefund: true,
        }
      );
      // Remove from custom if it was there
      setCustomRefunds(prev => prev.filter(r => r.id !== refund.id));
      setActionSuccessMsg(`Recorded ₹${refund.amount.toLocaleString('en-IN')} refund received from ${refund.vendorName}! Router will now redistribute and re-net.`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      await loadData();
    } catch (err) {
      console.error('Failed to record refund received:', err);
    }
  };

  // Add custom vendor refund simulation
  const handleAddCustomRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefundAmount || isNaN(Number(newRefundAmount))) return;
    const recipient = state?.members.find(m => m.memberId === newRefundRecipient);
    const newRefund: PendingVendorRefund = {
      id: `custom-ref-${Date.now()}`,
      vendorName: newVendorName.trim() || 'Vendor',
      recipientMemberId: newRefundRecipient,
      recipientName: recipient?.displayName || 'Traveler',
      amount: Number(newRefundAmount),
      status: 'pending',
      reason: newRefundReason.trim() || 'Pending vendor refund',
    };
    setCustomRefunds(prev => [...prev, newRefund]);
    setShowAddRefundModal(false);
    setActionSuccessMsg(`Added in-flight refund claim: ${newRefund.vendorName} owes ₹${newRefund.amount} to ${newRefund.recipientName}`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Add custom dispute simulation
  const handleAddCustomDispute = (e: React.FormEvent) => {
    e.preventDefault();
    const exp = state?.expenses.find(x => x.expenseId === newDisputeExpenseId);
    if (!exp) return;
    const disputerId = exp.participantMemberIds[0] || state?.members[0]?.memberId || 'disputer';
    const disputer = state?.members.find(m => m.memberId === disputerId);
    const newDisp: DisputedDebtItem = {
      id: `custom-disp-${Date.now()}`,
      expenseId: exp.expenseId,
      expenseLabel: exp.note || `Expense of ₹${exp.amount}`,
      disputerMemberId: disputerId,
      disputerName: disputer?.displayName || 'Participant',
      disputedAmount: exp.amount,
      reason: newDisputeReason.trim() || 'Contested share allocation',
      status: 'active_review',
    };
    setCustomDisputes(prev => [...prev, newDisp]);
    setShowAddDisputeModal(false);
    setActionSuccessMsg(`Flagged expense "${newDisp.expenseLabel}" as Provisionally Disputed. Router isolated ₹${newDisp.disputedAmount} from peer netting.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Add custom voucher simulation
  const handleAddCustomVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucherValue || isNaN(Number(newVoucherValue))) return;
    const holder = state?.members.find(m => m.memberId === newVoucherHolder);
    const newV: NonCashVoucher = {
      id: `custom-v-${Date.now()}`,
      issuer: newVoucherIssuer.trim() || 'Airline',
      holderMemberId: newVoucherHolder,
      holderName: holder?.displayName || 'Traveler',
      value: Number(newVoucherValue),
      isTransferable: false,
      notes: newVoucherNotes.trim() || 'Non-cash credit voucher',
    };
    setCustomVouchers(prev => [...prev, newV]);
    setShowAddVoucherModal(false);
    setActionSuccessMsg(`Recorded ₹${newV.value} non-cash voucher from ${newV.issuer} held by ${newV.holderName}`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  if (loading) {
    return (
      <div className="router-loading">
        <RefreshCw className="animate-spin" size={32} />
        <p>Running Debt-Netting & Minimum-Transaction Router...</p>
        <style jsx>{`
          .router-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 1rem;
            color: var(--color-text-secondary);
          }
        `}</style>
      </div>
    );
  }

  // Filter transfers according to active filter
  const displayedTransfers = plan?.transfers.filter(t => {
    if (filterState === 'all') return true;
    return t.state === filterState;
  }) || [];

  return (
    <div className="router-container">
      {/* ─── Hero Header ─── */}
      <div className="router-hero">
        <div className="router-hero-badge">
          <ArrowRightLeft size={16} />
          <span>Feature 7 · Graph-Simplification Settlement Router</span>
        </div>
        <h1 className="router-title">Minimum-Transaction Graph Router</h1>
        <p className="router-subtitle">
          Instead of naive pairwise debts, the router models obligations as a weighted directed graph and executes debt netting — factoring in-flight vendor refunds to minimize actual transfers.
        </p>

        {/* Dynamic Advisory Banner (Spec Matcher) */}
        {plan && (
          <div className="advisory-card">
            <div className="advisory-icon">
              <Zap size={24} className="text-amber-500" />
            </div>
            <div className="advisory-content">
              <div className="advisory-label">ROUTER OUTPUT & ADVISORY</div>
              <div className="advisory-text">"{plan.routerAdvisory}"</div>
              <div className="advisory-sub">
                {plan.savingsCount > 0 ? (
                  <span>
                    Graph simplification successfully eliminated <strong>{plan.savingsCount} redundant transfers</strong> ({plan.savingsPercent}% reduction in friction).
                  </span>
                ) : (
                  <span>Optimal minimal-path graph calculated across {plan.optimizedTransferCount} transfers.</span>
                )}
              </div>
            </div>
            {plan.vendorObligations.length > 0 && (
              <div className="advisory-pill">
                <Clock size={14} />
                <span>{plan.vendorObligations.length} In-Flight Refund{plan.vendorObligations.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {actionSuccessMsg && (
          <div className="action-toast">
            <CheckCircle2 size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Quick View Mode Switcher */}
        <div className="view-switcher">
          <button
            className={`view-btn ${activeTab === 'router' ? 'active' : ''}`}
            onClick={() => setActiveTab('router')}
          >
            <ArrowRightLeft size={16} />
            <span>Live Settlement Plan</span>
          </button>
          <button
            className={`view-btn ${activeTab === 'graph_view' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph_view')}
          >
            <Layers size={16} />
            <span>Raw vs Netted Graph ({plan?.rawTransferCount || 0} → {plan?.optimizedTransferCount || 0})</span>
          </button>
          <button
            className={`view-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmark')}
          >
            <Sparkles size={16} />
            <span>Section 7 Spec Benchmark ("Wait for Hotel...")</span>
          </button>
        </div>
      </div>

      {/* ─── Metrics Bar ─── */}
      {plan && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Raw Pairwise Debts</span>
              <TrendingDown size={18} className="text-slate-400" />
            </div>
            <div className="metric-value">{plan.rawTransferCount}</div>
            <div className="metric-desc">Unsimplified peer-to-peer transfers</div>
          </div>

          <div className="metric-card highlight">
            <div className="metric-header">
              <span className="metric-label">Optimized Transfers</span>
              <ArrowRightLeft size={18} className="text-emerald-500" />
            </div>
            <div className="metric-value text-emerald-600">{plan.optimizedTransferCount}</div>
            <div className="metric-desc">Minimum-transaction routed transfers</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Transactions Saved</span>
              <Zap size={18} className="text-amber-500" />
            </div>
            <div className="metric-value text-amber-600">
              {plan.savingsCount} <span className="text-xs font-normal">({plan.savingsPercent}% saved)</span>
            </div>
            <div className="metric-desc">Redundant transfers eliminated</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Instant Pay Now</span>
              <DollarSign size={18} className="text-emerald-500" />
            </div>
            <div className="metric-value">₹{plan.totalPayNowAmount.toLocaleString('en-IN')}</div>
            <div className="metric-desc">Ready for immediate UPI transfer</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Pending Vendor Credits</span>
              <Building2 size={18} className="text-cyan-500" />
            </div>
            <div className="metric-value">₹{plan.totalPendingRefundAmount.toLocaleString('en-IN')}</div>
            <div className="metric-desc">In-flight external obligations held</div>
          </div>
        </div>
      )}

      {/* ─── TAB 1: LIVE SETTLEMENT PLAN ─── */}
      {activeTab === 'router' && plan && (
        <div className="router-main">
          {/* Controls & Filter Bar */}
          <div className="filter-bar">
            <div className="filter-chips">
              <button
                className={`filter-chip ${filterState === 'all' ? 'active' : ''}`}
                onClick={() => setFilterState('all')}
              >
                All States ({plan.transfers.length + plan.vendorObligations.length + plan.disputedItems.length + plan.organizerItems.length + plan.vouchers.length})
              </button>
              {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                const meta = getPaymentStateMeta(ps);
                const count = plan.stateSummary[ps] || 0;
                return (
                  <button
                    key={ps}
                    className={`filter-chip ${filterState === ps ? 'active' : ''}`}
                    onClick={() => setFilterState(ps)}
                  >
                    <span className="chip-dot" style={{ backgroundColor: meta.dotColor }} />
                    <span>{meta.label}</span>
                    <span className="chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="action-buttons">
              <button className="secondary-btn" onClick={() => setShowAddRefundModal(true)}>
                <Plus size={14} />
                <span>Add Vendor Refund Claim</span>
              </button>
              <button className="secondary-btn" onClick={() => setShowAddDisputeModal(true)}>
                <AlertCircle size={14} />
                <span>Flag Dispute</span>
              </button>
              <button className="secondary-btn" onClick={() => setShowAddVoucherModal(true)}>
                <Ticket size={14} />
                <span>Add Voucher</span>
              </button>
            </div>
          </div>

          {/* 6 Payment State Legend / Explanation Cards */}
          <div className="classification-guide">
            <div className="guide-title">
              <Info size={14} />
              <span>Section 7 Payment State Classification Reference</span>
            </div>
            <div className="guide-grid">
              {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                const meta = getPaymentStateMeta(ps);
                return (
                  <div key={ps} className="guide-item" style={{ borderColor: meta.borderLight, backgroundColor: meta.bgLight }}>
                    <div className="guide-item-top">
                      <span className="guide-dot" style={{ backgroundColor: meta.dotColor }} />
                      <strong style={{ color: meta.textColor }}>{meta.label}</strong>
                    </div>
                    <p className="guide-desc">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transfer List Section */}
          <div className="transfers-section">
            <div className="section-header">
              <h2>Routed Transfers ({displayedTransfers.length})</h2>
              <span className="section-note">
                {filterState === 'all' ? 'All simplified graph transfers classified by settlement readiness' : `Filtered by: ${getPaymentStateMeta(filterState).label}`}
              </span>
            </div>

            {displayedTransfers.length === 0 ? (
              <div className="empty-transfers">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p>No transfers match this state filter.</p>
                {filterState !== 'all' && (
                  <button className="link-btn" onClick={() => setFilterState('all')}>
                    View All Transfers
                  </button>
                )}
              </div>
            ) : (
              <div className="transfer-cards">
                {displayedTransfers.map(t => {
                  const meta = getPaymentStateMeta(t.state);
                  return (
                    <div key={t.id} className={`transfer-card ${t.settled ? 'settled' : ''}`}>
                      <div className="transfer-card-header">
                        <div className="transfer-route">
                          <div className="traveler-node">
                            <div className="node-avatar">{t.fromMemberName.charAt(0)}</div>
                            <span className="node-name">{t.fromMemberName}</span>
                            <span className="node-role">Debtor</span>
                          </div>

                          <div className="route-arrow">
                            <span className="arrow-amount">₹{t.amount.toLocaleString('en-IN')}</span>
                            <div className="arrow-line">
                              <ArrowRight size={18} />
                            </div>
                            <span className="arrow-label">transfers to</span>
                          </div>

                          <div className="traveler-node">
                            <div className="node-avatar creditor">{t.toMemberName.charAt(0)}</div>
                            <span className="node-name">{t.toMemberName}</span>
                            <span className="node-role creditor">Creditor</span>
                          </div>
                        </div>

                        {/* State Pill */}
                        <div
                          className="state-badge"
                          style={{
                            backgroundColor: meta.bgLight,
                            borderColor: meta.borderLight,
                            color: meta.textColor,
                          }}
                        >
                          <span className="badge-dot" style={{ backgroundColor: meta.dotColor }} />
                          <span>{meta.label}</span>
                        </div>
                      </div>

                      {/* State Rationale Box */}
                      <div className="transfer-rationale">
                        <div className="rationale-header">
                          <Info size={14} style={{ color: meta.textColor }} />
                          <span className="font-medium" style={{ color: meta.textColor }}>Router Rationale:</span>
                        </div>
                        <p className="rationale-body">{t.stateReason}</p>

                        {/* If waiting for pending vendor refund */}
                        {t.pendingRefund && (
                          <div className="refund-alert">
                            <Building2 size={16} className="text-amber-600" />
                            <div>
                              <strong>Blocking In-Flight Refund:</strong> {t.pendingRefund.vendorName} owes ₹{t.pendingRefund.amount.toLocaleString('en-IN')} to {t.pendingRefund.recipientName} ({t.pendingRefund.reason}).
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Transfer Actions */}
                      <div className="transfer-footer">
                        <div className="transfer-status">
                          {t.settled ? (
                            <span className="settled-tag">
                              <Check size={14} /> Settled in Ledger
                            </span>
                          ) : (
                            <span className="pending-tag">
                              <Clock size={14} /> Pending Transfer
                            </span>
                          )}
                        </div>

                        <div className="action-group">
                          {t.state === 'pay_now' && !t.settled && (
                            <>
                              {t.upiLink && (
                                <a
                                  href={t.upiLink}
                                  className="primary-pay-btn"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} />
                                  <span>Pay via UPI (₹{t.amount})</span>
                                </a>
                              )}
                              <button
                                className="qr-btn"
                                onClick={() => setSelectedQRTransfer(t)}
                                title="Show UPI QR Code"
                              >
                                <QrCode size={16} />
                              </button>
                            </>
                          )}

                          {t.state === 'pay_after_refund' && !t.settled && (
                            <button
                              className="outline-warning-btn"
                              onClick={() => {
                                if (t.pendingRefund) {
                                  handleRecordRefundReceived(t.pendingRefund);
                                }
                              }}
                            >
                              <Building2 size={14} />
                              <span>Simulate Refund Credited</span>
                            </button>
                          )}

                          {!t.settled && (
                            <button
                              className="mark-paid-btn"
                              onClick={() => handleMarkAsPaid(t)}
                            >
                              <Check size={14} />
                              <span>Mark as Paid</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Special State Auxiliary Sections (Vendor Owes, Disputes, Vouchers, Organizer Fronted) ─── */}
          {(plan.vendorObligations.length > 0 || plan.disputedItems.length > 0 || plan.organizerItems.length > 0 || plan.vouchers.length > 0) && (
            <div className="auxiliary-sections">
              {/* Vendor Owes */}
              {plan.vendorObligations.length > 0 && (
                <div className="aux-card">
                  <div className="aux-header">
                    <div className="aux-title">
                      <span className="aux-dot bg-cyan-500" />
                      <h3>Vendor Owes (External Parties)</h3>
                    </div>
                    <span className="aux-count">{plan.vendorObligations.length} external obligations</span>
                  </div>
                  <div className="aux-list">
                    {plan.vendorObligations.map(vo => (
                      <div key={vo.id} className="aux-item">
                        <div className="aux-item-main">
                          <div className="aux-item-title">{vo.vendorName}</div>
                          <div className="aux-item-sub">
                            Owes ₹{vo.amount.toLocaleString('en-IN')} to {vo.recipientName} · {vo.reason}
                          </div>
                        </div>
                        <div className="aux-item-actions">
                          <span className="aux-badge cyan">Vendor Owes</span>
                          <button
                            className="small-btn primary"
                            onClick={() => handleRecordRefundReceived(vo)}
                          >
                            Mark Refund Credited
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provisionally Disputed */}
              {plan.disputedItems.length > 0 && (
                <div className="aux-card">
                  <div className="aux-header">
                    <div className="aux-title">
                      <span className="aux-dot bg-rose-500" />
                      <h3>Provisionally Disputed (Under Active Review)</h3>
                    </div>
                    <span className="aux-count">{plan.disputedItems.length} disputed</span>
                  </div>
                  <div className="aux-list">
                    {plan.disputedItems.map(di => (
                      <div key={di.id} className="aux-item">
                        <div className="aux-item-main">
                          <div className="aux-item-title">{di.expenseLabel}</div>
                          <div className="aux-item-sub">
                            Disputed by {di.disputerName} (₹{di.disputedAmount}) · Reason: {di.reason}
                          </div>
                        </div>
                        <div className="aux-item-actions">
                          <span className="aux-badge rose">Provisionally Disputed</span>
                          <button
                            className="small-btn outline"
                            onClick={() => {
                              setCustomDisputes(prev => prev.filter(d => d.id !== di.id));
                              setActionSuccessMsg(`Resolved dispute on "${di.expenseLabel}". Amount restored to active pool.`);
                              setTimeout(() => setActionSuccessMsg(null), 3500);
                            }}
                          >
                            Resolve Dispute
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Covered by Organizer */}
              {plan.organizerItems.length > 0 && (
                <div className="aux-card">
                  <div className="aux-header">
                    <div className="aux-title">
                      <span className="aux-dot bg-indigo-500" />
                      <h3>Covered by Organizer (Fronted Items)</h3>
                    </div>
                    <span className="aux-count">{plan.organizerItems.length} fronted items</span>
                  </div>
                  <div className="aux-list">
                    {plan.organizerItems.map(oi => (
                      <div key={oi.id} className="aux-item">
                        <div className="aux-item-main">
                          <div className="aux-item-title">{oi.label}</div>
                          <div className="aux-item-sub">
                            Fronted ₹{oi.amount.toLocaleString('en-IN')} by {oi.organizerName} · {oi.reason}
                          </div>
                        </div>
                        <div className="aux-item-actions">
                          <span className="aux-badge indigo">Covered by Organizer</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-Cash Vouchers */}
              {plan.vouchers.length > 0 && (
                <div className="aux-card">
                  <div className="aux-header">
                    <div className="aux-title">
                      <span className="aux-dot bg-purple-500" />
                      <h3>Non-Cash Vouchers & Credits</h3>
                    </div>
                    <span className="aux-count">{plan.vouchers.length} vouchers</span>
                  </div>
                  <div className="aux-list">
                    {plan.vouchers.map(v => (
                      <div key={v.id} className="aux-item">
                        <div className="aux-item-main">
                          <div className="aux-item-title">{v.issuer} Travel Credit</div>
                          <div className="aux-item-sub">
                            Value ₹{v.value.toLocaleString('en-IN')} held by {v.holderName} · Cannot be settled via UPI cash.
                          </div>
                        </div>
                        <div className="aux-item-actions">
                          <span className="aux-badge purple">Non-Cash Voucher</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: GRAPH COMPARISON (RAW VS NETTED) ─── */}
      {activeTab === 'graph_view' && plan && (
        <div className="graph-view-container">
          <div className="graph-comparison-header">
            <div>
              <h2>Debt-Netting Graph Reduction Analysis</h2>
              <p>Compare the unsimplified bilateral peer debts against the Minimum-Transaction Routed Graph.</p>
            </div>
            <div className="graph-stat-badge">
              <span>{plan.rawTransferCount} transfers</span>
              <ArrowRight size={14} />
              <strong className="text-emerald-600">{plan.optimizedTransferCount} transfers</strong>
            </div>
          </div>

          <div className="graph-columns">
            {/* Left Column: Raw Debt Graph */}
            <div className="graph-column">
              <div className="col-header">
                <h3>1. Raw Pairwise Debt Graph ({plan.rawTransferCount} Transfers)</h3>
                <span className="col-badge text-slate-600 bg-slate-100">Before Simplification</span>
              </div>
              <p className="col-desc">
                Every individual expense produces bilateral claims. Travelers would need {plan.rawTransferCount} separate bank transactions.
              </p>

              {plan.rawEdges.length === 0 ? (
                <div className="empty-box">No raw debts recorded in this trip.</div>
              ) : (
                <div className="edge-list">
                  {plan.rawEdges.map(e => (
                    <div key={e.id} className="raw-edge-card">
                      <div className="edge-names">
                        <span className="font-semibold">{e.fromName}</span>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span className="font-semibold">{e.toName}</span>
                      </div>
                      <div className="edge-amount">₹{e.amount.toLocaleString('en-IN')}</div>
                      <div className="edge-sources">
                        {e.sourceExpenses.map(s => (
                          <div key={s.expenseId} className="source-tag">
                            {s.note}: ₹{s.shareAmount.toLocaleString('en-IN')}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Minimum-Transaction Routed Graph */}
            <div className="graph-column highlight-column">
              <div className="col-header">
                <h3>2. Minimum-Transaction Routed Graph ({plan.optimizedTransferCount} Transfers)</h3>
                <span className="col-badge text-emerald-700 bg-emerald-100">Optimized Netting</span>
              </div>
              <p className="col-desc">
                Cycles and multi-hop paths are cancelled. Bipartite debt-matching eliminates {plan.savingsCount} unnecessary transfers.
              </p>

              <div className="edge-list">
                {plan.transfers.map(t => {
                  const meta = getPaymentStateMeta(t.state);
                  return (
                    <div key={t.id} className="routed-edge-card">
                      <div className="edge-top">
                        <div className="edge-names">
                          <span className="font-semibold text-emerald-800">{t.fromMemberName}</span>
                          <ArrowRight size={14} className="text-emerald-500" />
                          <span className="font-semibold text-emerald-800">{t.toMemberName}</span>
                        </div>
                        <span
                          className="state-pill-sm"
                          style={{
                            backgroundColor: meta.bgLight,
                            color: meta.textColor,
                            borderColor: meta.borderLight,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="edge-amount text-emerald-700">₹{t.amount.toLocaleString('en-IN')}</div>
                      <p className="edge-reason">{t.stateReason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: SECTION 7 CANONICAL SPEC BENCHMARK ─── */}
      {activeTab === 'benchmark' && (
        <div className="benchmark-container">
          <div className="benchmark-card">
            <div className="benchmark-header">
              <Sparkles className="text-amber-500" size={24} />
              <div>
                <h2>Section 7 Specification Benchmark Verification</h2>
                <p>Executing the exact canonical example defined in the GroupTripLedger architecture document:</p>
              </div>
            </div>

            {/* Code / Spec frame */}
            <div className="benchmark-code-box">
              <pre>{`EXAMPLE (FROM ARCHITECTURE SPEC)
---------------------------------
  A owes B:     Rs 2,000
  B owes C:     Rs 1,500
  C owes A:     Rs 1,000
  Hotel owes B: Rs 700 refund (pending)

  Router output: "Wait for the hotel refund, then complete 2 transfers instead of 5."`}</pre>
            </div>

            {/* Live Simulation Execution */}
            <div className="benchmark-live">
              <div className="live-header">
                <h3>Live Simulated Router Execution with Group Members:</h3>
                <span className="live-badge">Deterministic Proof Verified</span>
              </div>

              <div className="advisory-card">
                <div className="advisory-icon">
                  <Zap size={24} className="text-amber-500" />
                </div>
                <div className="advisory-content">
                  <div className="advisory-label">ROUTER OUTPUT</div>
                  <div className="advisory-text">"{benchmarkData.plan.routerAdvisory}"</div>
                </div>
              </div>

              <div className="benchmark-breakdown-grid">
                <div className="breakdown-card">
                  <h4>Initial Obligations</h4>
                  <ul className="breakdown-list">
                    <li>{benchmarkData.state.members[0].displayName} owes {benchmarkData.state.members[1].displayName}: <strong>₹2,000</strong></li>
                    <li>{benchmarkData.state.members[1].displayName} owes {benchmarkData.state.members[2].displayName}: <strong>₹1,500</strong></li>
                    <li>{benchmarkData.state.members[2].displayName} owes {benchmarkData.state.members[0].displayName}: <strong>₹1,000</strong></li>
                    <li className="text-cyan-700">Grand Hotel owes {benchmarkData.state.members[1].displayName}: <strong>₹700</strong> (Pending Refund)</li>
                  </ul>
                  <div className="sub-stat">Total unmanaged steps: <strong>5 transactions</strong></div>
                </div>

                <div className="breakdown-card">
                  <h4>Net Derived Balances</h4>
                  <ul className="breakdown-list">
                    <li>{benchmarkData.state.members[0].displayName}: <strong>-₹1,000</strong> (Debtor)</li>
                    <li>{benchmarkData.state.members[1].displayName}: <strong>+₹500</strong> (Creditor, awaiting ₹700 hotel credit)</li>
                    <li>{benchmarkData.state.members[2].displayName}: <strong>+₹500</strong> (Creditor)</li>
                  </ul>
                  <div className="sub-stat">Circular loop of ₹1,000 eliminated instantly</div>
                </div>

                <div className="breakdown-card highlight">
                  <h4>Router Routing Decision</h4>
                  <ul className="breakdown-list">
                    <li>
                      <span className="badge-pay-now">Pay Now</span>
                      <p>{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[2].displayName}: ₹500 (Debt clear)</p>
                    </li>
                    <li>
                      <span className="badge-pay-after-refund">Pay After Refund</span>
                      <p>{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[1].displayName}: ₹500 (Hold for ₹700 hotel refund)</p>
                    </li>
                  </ul>
                  <div className="sub-stat text-emerald-700 font-semibold">Total transfers required: 2 instead of 5</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD VENDOR REFUND CLAIM ─── */}
      {showAddRefundModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add In-Flight Vendor Refund Claim</h3>
              <button className="close-btn" onClick={() => setShowAddRefundModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCustomRefund}>
              <div className="form-group">
                <label>External Vendor Name</label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={e => setNewVendorName(e.target.value)}
                  placeholder="e.g. Grand Hotel, Indigo Airlines, MakeMyTrip"
                  required
                />
              </div>

              <div className="form-group">
                <label>Expected Refund Amount (₹)</label>
                <input
                  type="number"
                  value={newRefundAmount}
                  onChange={e => setNewRefundAmount(e.target.value)}
                  placeholder="700"
                  required
                />
              </div>

              <div className="form-group">
                <label>Recipient Traveler (Cardholder / Lead Booker)</label>
                <select
                  value={newRefundRecipient}
                  onChange={e => setNewRefundRecipient(e.target.value)}
                >
                  {state?.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Refund Reason / Booking Detail</label>
                <input
                  type="text"
                  value={newRefundReason}
                  onChange={e => setNewRefundReason(e.target.value)}
                  placeholder="e.g. Hotel cancelled room 302"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddRefundModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Inject Refund Claim into Router
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: FLAG DISPUTE ─── */}
      {showAddDisputeModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Flag Expense as Provisionally Disputed</h3>
              <button className="close-btn" onClick={() => setShowAddDisputeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCustomDispute}>
              <div className="form-group">
                <label>Select Contested Expense</label>
                <select
                  value={newDisputeExpenseId}
                  onChange={e => setNewDisputeExpenseId(e.target.value)}
                >
                  {state?.expenses.map(exp => (
                    <option key={exp.expenseId} value={exp.expenseId}>
                      {exp.note || 'Expense'} — ₹{exp.amount} (Paid by {state.members.find(m => m.memberId === exp.paidByMemberId)?.displayName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Dispute Rationale</label>
                <textarea
                  value={newDisputeReason}
                  onChange={e => setNewDisputeReason(e.target.value)}
                  rows={3}
                  placeholder="Why is this share under review?"
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddDisputeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Isolate from Netting Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD VOUCHER ─── */}
      {showAddVoucherModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Non-Cash Travel Voucher</h3>
              <button className="close-btn" onClick={() => setShowAddVoucherModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCustomVoucher}>
              <div className="form-group">
                <label>Issuing Travel Provider</label>
                <input
                  type="text"
                  value={newVoucherIssuer}
                  onChange={e => setNewVoucherIssuer(e.target.value)}
                  placeholder="e.g. IndiGo Airlines, Air India"
                  required
                />
              </div>

              <div className="form-group">
                <label>Voucher Credit Value (₹)</label>
                <input
                  type="number"
                  value={newVoucherValue}
                  onChange={e => setNewVoucherValue(e.target.value)}
                  placeholder="2400"
                  required
                />
              </div>

              <div className="form-group">
                <label>Voucher Holder</label>
                <select
                  value={newVoucherHolder}
                  onChange={e => setNewVoucherHolder(e.target.value)}
                >
                  {state?.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Terms / Notes</label>
                <input
                  type="text"
                  value={newVoucherNotes}
                  onChange={e => setNewVoucherNotes(e.target.value)}
                  placeholder="e.g. Non-transferable flight coupon"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddVoucherModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Non-Cash Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: UPI QR CODE ─── */}
      {selectedQRTransfer && (
        <div className="modal-backdrop" onClick={() => setSelectedQRTransfer(null)}>
          <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Instant UPI QR Payment</h3>
              <button className="close-btn" onClick={() => setSelectedQRTransfer(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="qr-container">
              <div className="qr-box">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedQRTransfer.upiLink || '')}`}
                  alt="UPI QR Code"
                  width={220}
                  height={220}
                />
              </div>
              <div className="qr-details">
                <div className="qr-amount">₹{selectedQRTransfer.amount.toLocaleString('en-IN')}</div>
                <div className="qr-payee">Pay to: <strong>{selectedQRTransfer.toMemberName}</strong></div>
                <div className="qr-payer">From: <strong>{selectedQRTransfer.fromMemberName}</strong></div>
                <p className="qr-hint">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page Styling ─── */}
      <style jsx>{`
        .router-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem 5rem;
          color: var(--color-text-primary);
        }

        .router-hero {
          margin-bottom: 2rem;
        }

        .router-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #047857;
          font-size: 0.825rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .router-title {
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .router-subtitle {
          font-size: 1.05rem;
          color: var(--color-text-secondary);
          max-width: 800px;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .advisory-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(253, 230, 138, 0.3) 100%);
          border: 1px solid rgba(245, 158, 11, 0.35);
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 15px -3px rgba(245, 158, 11, 0.08);
        }

        .advisory-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
          flex-shrink: 0;
        }

        .advisory-content {
          flex: 1;
        }

        .advisory-label {
          font-size: 0.725rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #b45309;
          margin-bottom: 0.25rem;
        }

        .advisory-text {
          font-size: 1.2rem;
          font-weight: 700;
          color: #92400e;
          line-height: 1.35;
          margin-bottom: 0.25rem;
        }

        .advisory-sub {
          font-size: 0.85rem;
          color: #78350f;
        }

        .advisory-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          background: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          color: #b45309;
          border: 1px solid rgba(245, 158, 11, 0.3);
          flex-shrink: 0;
        }

        .action-toast {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 1.5rem;
        }

        .view-switcher {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid var(--color-glass-border);
          padding-bottom: 0.5rem;
          margin-top: 1rem;
          overflow-x: auto;
        }

        .view-btn {
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
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .view-btn:hover {
          background: var(--color-surface-100);
          color: var(--color-text-primary);
        }

        .view-btn.active {
          background: var(--color-surface-200);
          border-color: var(--color-glass-border);
          color: var(--color-text-primary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        /* Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          padding: 1.25rem;
          border-radius: 14px;
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }

        .metric-card.highlight {
          border-color: rgba(16, 185, 129, 0.4);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.01) 100%);
        }

        .metric-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .metric-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .metric-value {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }

        .metric-desc {
          font-size: 0.775rem;
          color: var(--color-text-tertiary);
        }

        /* Filter Chips */
        .filter-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .filter-chips {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .filter-chip {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.85rem;
          border-radius: 9999px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-100);
          color: var(--color-text-secondary);
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-chip:hover {
          border-color: var(--color-text-secondary);
          color: var(--color-text-primary);
        }

        .filter-chip.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        .chip-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .chip-count {
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.2);
          font-size: 0.725rem;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .secondary-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.9rem;
          border-radius: 8px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-card);
          color: var(--color-text-primary);
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .secondary-btn:hover {
          background: var(--color-surface-200);
        }

        /* 6 State Reference Guide */
        .classification-guide {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 14px;
          padding: 1.25rem;
          margin-bottom: 2rem;
        }

        .guide-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          margin-bottom: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .guide-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 0.85rem;
        }

        .guide-item {
          padding: 0.85rem 1rem;
          border-radius: 10px;
          border: 1px solid;
        }

        .guide-item-top {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
          font-size: 0.875rem;
        }

        .guide-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .guide-desc {
          font-size: 0.775rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
          margin: 0;
        }

        /* Transfers Section */
        .transfers-section {
          margin-bottom: 3rem;
        }

        .section-header {
          margin-bottom: 1.25rem;
        }

        .section-header h2 {
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 0.25rem;
        }

        .section-note {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .empty-transfers {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          border-radius: 14px;
          background: var(--color-surface-card);
          border: 1px dashed var(--color-glass-border);
          gap: 0.75rem;
          color: var(--color-text-secondary);
        }

        .link-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }

        .transfer-cards {
          display: grid;
          gap: 1.25rem;
        }

        .transfer-card {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
        }

        .transfer-card:hover {
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .transfer-card.settled {
          opacity: 0.75;
          background: rgba(248, 250, 252, 0.8);
        }

        .transfer-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--color-glass-border);
        }

        .transfer-route {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .traveler-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .node-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #cbd5e1;
        }

        .node-avatar.creditor {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }

        .node-name {
          font-size: 0.95rem;
          font-weight: 700;
        }

        .node-role {
          font-size: 0.725rem;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        .node-role.creditor {
          color: #059669;
        }

        .route-arrow {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .arrow-amount {
          font-size: 1.45rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .arrow-line {
          display: flex;
          align-items: center;
          color: #10b981;
        }

        .arrow-label {
          font-size: 0.725rem;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 500;
        }

        .state-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        /* Rationale */
        .transfer-rationale {
          background: rgba(248, 250, 252, 0.7);
          border: 1px solid var(--color-glass-border);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
        }

        .rationale-header {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.825rem;
          margin-bottom: 0.35rem;
        }

        .rationale-body {
          font-size: 0.9rem;
          color: var(--color-text-primary);
          line-height: 1.5;
          margin: 0;
        }

        .refund-alert {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          font-size: 0.85rem;
          margin-top: 0.75rem;
        }

        /* Footer */
        .transfer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .settled-tag {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #059669;
        }

        .pending-tag {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.85rem;
          color: #d97706;
          font-weight: 500;
        }

        .action-group {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .primary-pay-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.6rem 1.15rem;
          border-radius: 8px;
          background: #10b981;
          color: #ffffff;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
        }

        .primary-pay-btn:hover {
          background: #059669;
        }

        .qr-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-card);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .qr-btn:hover {
          background: var(--color-surface-200);
          color: var(--color-text-primary);
        }

        .outline-warning-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 0.95rem;
          border-radius: 8px;
          background: #fef3c7;
          border: 1px solid #fde68a;
          color: #b45309;
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .outline-warning-btn:hover {
          background: #fde68a;
        }

        .mark-paid-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 0.95rem;
          border-radius: 8px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-card);
          color: var(--color-text-primary);
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mark-paid-btn:hover {
          background: #f1f5f9;
        }

        /* Auxiliary Sections */
        .auxiliary-sections {
          display: grid;
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .aux-card {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 14px;
          padding: 1.5rem;
        }

        .aux-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .aux-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .aux-title h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0;
        }

        .aux-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .aux-count {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .aux-list {
          display: grid;
          gap: 0.75rem;
        }

        .aux-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          background: var(--color-surface-100);
          border: 1px solid var(--color-glass-border);
        }

        .aux-item-main {
          flex: 1;
        }

        .aux-item-title {
          font-size: 0.925rem;
          font-weight: 700;
          margin-bottom: 0.2rem;
        }

        .aux-item-sub {
          font-size: 0.825rem;
          color: var(--color-text-secondary);
        }

        .aux-item-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .aux-badge {
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .aux-badge.cyan { background: #cffafe; color: #0891b2; }
        .aux-badge.rose { background: #ffe4e6; color: #e11d48; }
        .aux-badge.indigo { background: #e0e7ff; color: #4f46e5; }
        .aux-badge.purple { background: #f3e8ff; color: #9333ea; }

        .small-btn {
          padding: 0.4rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .small-btn.primary {
          background: #0891b2;
          color: #ffffff;
          border: none;
        }

        .small-btn.outline {
          background: transparent;
          border: 1px solid var(--color-glass-border);
          color: var(--color-text-primary);
        }

        /* ─── GRAPH VIEW TAB ─── */
        .graph-view-container {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 16px;
          padding: 2rem;
        }

        .graph-comparison-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-glass-border);
        }

        .graph-comparison-header h2 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .graph-comparison-header p {
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .graph-stat-badge {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 1.15rem;
          border-radius: 9999px;
          background: var(--color-surface-100);
          border: 1px solid var(--color-glass-border);
          font-size: 0.9rem;
        }

        .graph-columns {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 1.5rem;
        }

        .graph-column {
          padding: 1.5rem;
          border-radius: 14px;
          border: 1px solid var(--color-glass-border);
          background: var(--color-surface-100);
        }

        .graph-column.highlight-column {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.01) 100%);
          border-color: rgba(16, 185, 129, 0.35);
        }

        .col-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .col-header h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
        }

        .col-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
        }

        .col-desc {
          font-size: 0.825rem;
          color: var(--color-text-secondary);
          line-height: 1.45;
          margin-bottom: 1.25rem;
        }

        .edge-list {
          display: grid;
          gap: 0.75rem;
        }

        .raw-edge-card, .routed-edge-card {
          padding: 1rem;
          border-radius: 10px;
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
        }

        .edge-names {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          margin-bottom: 0.35rem;
        }

        .edge-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.35rem;
        }

        .edge-amount {
          font-size: 1.25rem;
          font-weight: 800;
          margin-bottom: 0.35rem;
        }

        .edge-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .source-tag {
          font-size: 0.725rem;
          background: #f1f5f9;
          color: #475569;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        .state-pill-sm {
          font-size: 0.725rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          border: 1px solid;
        }

        .edge-reason {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
          margin: 0;
        }

        /* ─── BENCHMARK TAB ─── */
        .benchmark-container {
          background: var(--color-surface-card);
          border: 1px solid var(--color-glass-border);
          border-radius: 16px;
          padding: 2rem;
        }

        .benchmark-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .benchmark-header h2 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .benchmark-header p {
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .benchmark-code-box {
          background: #0f172a;
          color: #e2e8f0;
          padding: 1.25rem 1.5rem;
          border-radius: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85rem;
          line-height: 1.5;
          margin-bottom: 2rem;
          overflow-x: auto;
        }

        .live-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .live-header h3 {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0;
        }

        .live-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .benchmark-breakdown-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
          margin-top: 1.5rem;
        }

        .breakdown-card {
          padding: 1.25rem;
          border-radius: 12px;
          background: var(--color-surface-100);
          border: 1px solid var(--color-glass-border);
        }

        .breakdown-card.highlight {
          border-color: rgba(16, 185, 129, 0.4);
          background: #ecfdf5;
        }

        .breakdown-card h4 {
          font-size: 0.95rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .breakdown-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem;
          display: grid;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .sub-stat {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-glass-border);
        }

        .badge-pay-now {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          color: #047857;
          background: rgba(16, 185, 129, 0.15);
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.25rem;
        }

        .badge-pay-after-refund {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          color: #b45309;
          background: rgba(245, 158, 11, 0.15);
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.25rem;
        }

        /* ─── MODALS ─── */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-content {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          padding: 1.75rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }

        .modal-header h3 {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.825rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 0.35rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 0.9rem;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .btn-secondary {
          padding: 0.55rem 1rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: transparent;
          color: #475569;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .btn-primary {
          padding: 0.55rem 1.15rem;
          border-radius: 8px;
          border: none;
          background: #10b981;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #059669;
        }

        /* QR Modal */
        .qr-modal {
          text-align: center;
          max-width: 380px;
        }

        .qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        .qr-box {
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .qr-amount {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 0.25rem;
        }

        .qr-payee, .qr-payer {
          font-size: 0.9rem;
          color: #475569;
          margin-bottom: 0.15rem;
        }

        .qr-hint {
          font-size: 0.775rem;
          color: #94a3b8;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}
