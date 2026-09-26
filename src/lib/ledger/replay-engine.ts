// ─── Replay Engine: Derive All State from Events ────────────────────────────
// This is the heart of the event-sourced architecture.
// Every piece of financial state is computed by replaying the event stream.
// NOTHING is read from stored balances — everything is derived.
//
// This engine integrates with the existing computeShares/simplifyDebts
// functions in engine.ts, wrapping them in event-aware replay logic.

import type {
  LedgerEvent,
  LedgerEventType,
  TripCreatedPayload,
  TripUpdatedPayload,
  ParticipantJoinedPayload,
  ParticipantLeftPayload,
  BookingCreatedPayload,
  BookingUpdatedPayload,
  BookingCancelledPayload,
  ExpenseAddedPayload,
  ExpenseDeletedPayload,
  PaymentMadePayload,
  RefundReceivedPayload,
  RefundRedistributedPayload,
  SplitChangedPayload,
  ParticipantOptedOutPayload,
  ParticipantOptedInPayload,
  WhatIfForkApprovedPayload,
  ConstitutionUpdatedPayload,
} from './event-types';

import { computeShares, simplifyDebts, type SplitType } from '../engine';
import { DEFAULT_CONSTITUTION, type FairnessRule, generateRuleCitation } from './fairness-rules';

// ─── Derived State Types ────────────────────────────────────────────────────

export interface DerivedMember {
  memberId: string;
  userId: string;
  displayName: string;
  joinedAt: string;
  isActive: boolean;        // false if they left
  leftAt?: string;
  leftReason?: string;
}

export interface DerivedBooking {
  itemId: string;
  type: string;
  label: string;
  cost: number;
  currency: string;
  defaultSplitType: SplitType;
  participantMemberIds: string[];
  startTime: string | null;
  endTime: string | null;
  vendorName: string | null;
  cancellationPolicy: string | null;
  status: 'active' | 'cancelled';
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  refundAmount?: number;
  penaltyAmount?: number;
  createdAt: string;
}

export interface DerivedExpense {
  expenseId: string;
  itemId: string | null;
  amount: number;
  currency: string;
  paidByMemberId: string;
  splitType: SplitType;
  participantMemberIds: string[];
  percentages?: Record<string, number>;
  note: string | null;
  receiptUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  deletedAt?: string;
}

export interface DerivedPayment {
  settlementId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  method: string;
  timestamp: string;
}

export interface DerivedRefund {
  refundId: string;
  linkedItemId: string;
  amount: number;
  currency: string;
  receivedByMemberId: string;
  vendorName: string | null;
  isFullRefund: boolean;
  isRedistributed: boolean;
  distributions?: { memberId: string; amount: number }[];
  receivedAt: string;
}

export interface BalanceTrace {
  eventId: string;
  eventType: LedgerEventType;
  timestamp: string;
  description: string;
  impact: number;             // positive = you get money, negative = you owe
  runningBalance: number;     // cumulative after this event
  applicableRule?: {
    ruleNumber: number;
    ruleId: string;
    ruleName: string;
    citation: string;
  };
}

export interface TripState {
  // Trip metadata
  tripId: string;
  tripName: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  inviteCode: string;

  // Derived entities
  members: DerivedMember[];
  bookings: DerivedBooking[];
  expenses: DerivedExpense[];
  payments: DerivedPayment[];
  refunds: DerivedRefund[];

  // Computed financial state
  balances: Record<string, number>;   // memberId → net balance (+ = owed, - = owes)
  settlements: { from: string; to: string; amount: number }[];
  totalSpent: number;
  totalRefunded: number;
  totalSettled: number;

  // Event stream metadata
  eventCount: number;
  lastEventVersion: number;
  lastEventTimestamp: string | null;

  // Fork milestones (What-If branches approved into official ledger)
  forkHistory?: {
    forkId: string;
    scenarioName: string;
    proposalSummary: string;
    recommendation: string;
    totalGroupImpact: number;
    approvedByMemberId: string;
    priorVersion: number;
    timestamp: string;
    changesApplied?: string[];
  }[];

  // Active Fairness Constitution
  constitution: FairnessRule[];
}

// ─── Initial State ──────────────────────────────────────────────────────────

function initialState(tripId: string): TripState {
  return {
    tripId,
    tripName: '',
    destination: null,
    startDate: null,
    endDate: null,
    inviteCode: '',

    members: [],
    bookings: [],
    expenses: [],
    payments: [],
    refunds: [],

    balances: {},
    settlements: [],
    totalSpent: 0,
    totalRefunded: 0,
    totalSettled: 0,

    eventCount: 0,
    lastEventVersion: 0,
    lastEventTimestamp: null,
    forkHistory: [],
    constitution: [...DEFAULT_CONSTITUTION],
  };
}

// ─── Event Handlers ─────────────────────────────────────────────────────────
// Each handler is a pure function: (state, event) → newState
// No side effects. No Firestore reads. Just state transformation.

function handleTripCreated(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as TripCreatedPayload;
  return {
    ...state,
    tripName: p.tripName,
    destination: p.destination,
    startDate: p.startDate,
    endDate: p.endDate,
    inviteCode: p.inviteCode,
  };
}

function handleTripUpdated(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as TripUpdatedPayload;
  return {
    ...state,
    tripName: p.changes.tripName ?? state.tripName,
    destination: p.changes.destination ?? state.destination,
    startDate: p.changes.startDate ?? state.startDate,
    endDate: p.changes.endDate ?? state.endDate,
  };
}

function handleParticipantJoined(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ParticipantJoinedPayload;

  // Idempotent: if already exists, don't add again
  if (state.members.some(m => m.memberId === p.memberId)) {
    return state;
  }

  return {
    ...state,
    members: [...state.members, {
      memberId: p.memberId,
      userId: p.userId,
      displayName: p.displayName,
      joinedAt: event.timestamp,
      isActive: true,
    }],
  };
}

function handleParticipantLeft(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ParticipantLeftPayload;

  return {
    ...state,
    members: state.members.map(m =>
      m.memberId === p.memberId
        ? { ...m, isActive: false, leftAt: event.timestamp, leftReason: p.reason }
        : m
    ),
  };
}

function handleBookingCreated(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as BookingCreatedPayload;
  const existingIdx = state.bookings.findIndex(b => b.itemId === p.itemId);

  const newBooking: DerivedBooking = {
    itemId: p.itemId,
    type: p.type,
    label: p.label,
    cost: p.cost,
    currency: p.currency,
    defaultSplitType: p.defaultSplitType as SplitType,
    participantMemberIds: [...p.participantMemberIds],
    startTime: p.startTime,
    endTime: p.endTime,
    vendorName: p.vendorName ?? null,
    cancellationPolicy: p.cancellationPolicy ?? null,
    status: 'active',
    createdAt: event.timestamp,
  };

  if (existingIdx >= 0) {
    const updated = [...state.bookings];
    updated[existingIdx] = newBooking;
    return { ...state, bookings: updated };
  }

  return {
    ...state,
    bookings: [...state.bookings, newBooking],
  };
}

function handleBookingUpdated(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as BookingUpdatedPayload;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.itemId === p.itemId
        ? {
            ...b,
            label: p.changes.label ?? b.label,
            cost: p.changes.cost ?? b.cost,
            startTime: p.changes.startTime ?? b.startTime,
            endTime: p.changes.endTime ?? b.endTime,
            defaultSplitType: (p.changes.defaultSplitType as SplitType) ?? b.defaultSplitType,
            vendorName: p.changes.vendorName ?? b.vendorName,
          }
        : b
    ),
  };
}

function handleBookingCancelled(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as BookingCancelledPayload;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.itemId === p.itemId
        ? {
            ...b,
            status: 'cancelled' as const,
            cancelledAt: event.timestamp,
            cancelledBy: p.cancelledBy,
            cancelReason: p.reason,
            refundAmount: p.refundAmount ?? undefined,
            penaltyAmount: p.penaltyAmount ?? undefined,
          }
        : b
    ),
  };
}

function handleExpenseAdded(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ExpenseAddedPayload;
  const existingIdx = state.expenses.findIndex(e => e.expenseId === p.expenseId);

  const newExpense: DerivedExpense = {
    expenseId: p.expenseId,
    itemId: p.itemId,
    amount: p.amount,
    currency: p.currency,
    paidByMemberId: p.paidByMemberId,
    splitType: p.splitType as SplitType,
    participantMemberIds: [...p.participantMemberIds],
    percentages: p.percentages,
    note: p.note,
    receiptUrl: p.receiptUrl,
    isDeleted: false,
    createdAt: event.timestamp,
  };

  if (existingIdx >= 0) {
    const updated = [...state.expenses];
    updated[existingIdx] = newExpense;
    return { ...state, expenses: updated };
  }

  return {
    ...state,
    expenses: [...state.expenses, newExpense],
  };
}

function handleExpenseDeleted(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ExpenseDeletedPayload;

  return {
    ...state,
    expenses: state.expenses.map(e =>
      e.expenseId === p.expenseId
        ? { ...e, isDeleted: true, deletedAt: event.timestamp }
        : e
    ),
  };
}

function handlePaymentMade(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as PaymentMadePayload;

  return {
    ...state,
    payments: [...state.payments, {
      settlementId: p.settlementId,
      fromMemberId: p.fromMemberId,
      toMemberId: p.toMemberId,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      timestamp: event.timestamp,
    }],
  };
}

function handleRefundReceived(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as RefundReceivedPayload;

  return {
    ...state,
    refunds: [...state.refunds, {
      refundId: p.refundId,
      linkedItemId: p.linkedItemId,
      amount: p.amount,
      currency: p.currency,
      receivedByMemberId: p.receivedByMemberId,
      vendorName: p.vendorName,
      isFullRefund: p.isFullRefund,
      isRedistributed: false,
      receivedAt: event.timestamp,
    }],
  };
}

function handleRefundRedistributed(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as RefundRedistributedPayload;

  return {
    ...state,
    refunds: state.refunds.map(r =>
      r.refundId === p.refundId
        ? { ...r, isRedistributed: true, distributions: p.distributions }
        : r
    ),
  };
}

function handleSplitChanged(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as SplitChangedPayload;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.itemId === p.itemId
        ? {
            ...b,
            defaultSplitType: p.newSplitType as SplitType,
            participantMemberIds: [...p.newParticipants],
          }
        : b
    ),
  };
}

function handleParticipantOptedOut(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ParticipantOptedOutPayload;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.itemId === p.itemId
        ? {
            ...b,
            participantMemberIds: b.participantMemberIds.filter(id => id !== p.memberId),
          }
        : b
    ),
  };
}

function handleParticipantOptedIn(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ParticipantOptedInPayload;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.itemId === p.itemId && !b.participantMemberIds.includes(p.memberId)
        ? {
            ...b,
            participantMemberIds: [...b.participantMemberIds, p.memberId],
          }
        : b
    ),
  };
}

function handleWhatIfForkApproved(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as WhatIfForkApprovedPayload;
  return {
    ...state,
    forkHistory: [
      ...(state.forkHistory || []),
      {
        forkId: p.forkId,
        scenarioName: p.scenarioName,
        proposalSummary: p.proposalSummary,
        recommendation: p.recommendation,
        totalGroupImpact: p.totalGroupImpact,
        approvedByMemberId: p.approvedByMemberId,
        priorVersion: p.priorVersion,
        timestamp: event.timestamp,
        changesApplied: p.changesApplied,
      },
    ],
  };
}

function handleConstitutionUpdated(state: TripState, event: LedgerEvent): TripState {
  const p = event.payload as ConstitutionUpdatedPayload;
  return {
    ...state,
    constitution: p.rules,
  };
}

// ─── Event Handler Registry ─────────────────────────────────────────────────

const eventHandlers: Record<LedgerEventType, (state: TripState, event: LedgerEvent) => TripState> = {
  'TRIP_CREATED': handleTripCreated,
  'TRIP_UPDATED': handleTripUpdated,
  'PARTICIPANT_JOINED': handleParticipantJoined,
  'PARTICIPANT_LEFT': handleParticipantLeft,
  'BOOKING_CREATED': handleBookingCreated,
  'BOOKING_UPDATED': handleBookingUpdated,
  'BOOKING_CANCELLED': handleBookingCancelled,
  'EXPENSE_ADDED': handleExpenseAdded,
  'EXPENSE_DELETED': handleExpenseDeleted,
  'PAYMENT_MADE': handlePaymentMade,
  'REFUND_RECEIVED': handleRefundReceived,
  'REFUND_REDISTRIBUTED': handleRefundRedistributed,
  'SPLIT_CHANGED': handleSplitChanged,
  'PARTICIPANT_OPTED_OUT': handleParticipantOptedOut,
  'PARTICIPANT_OPTED_IN': handleParticipantOptedIn,
  'WHAT_IF_FORK_APPROVED': handleWhatIfForkApproved,
  'CONSTITUTION_UPDATED': handleConstitutionUpdated,
};

// ─── Core Replay Function ───────────────────────────────────────────────────

/**
 * THE MAIN FUNCTION.
 * Takes an ordered event stream and produces the complete derived state.
 * Pure function: same events in → same state out. Always.
 */
export function replayEvents(tripId: string, events: LedgerEvent[]): TripState {
  // Step 1: Fold events into entity state
  let state = initialState(tripId);

  for (const event of events) {
    const handler = eventHandlers[event.type];
    if (handler) {
      state = handler(state, event);
    }

    // Track event stream metadata
    state.eventCount = event.version;
    state.lastEventVersion = event.version;
    state.lastEventTimestamp = event.timestamp;
  }

  // Step 2: Compute financial aggregates from derived entities
  state = computeFinancials(state);

  return state;
}

/**
 * Computes balances, settlements, and totals from the derived entities.
 * Uses the existing engine.ts functions (computeShares, simplifyDebts).
 */
function computeFinancials(state: TripState): TripState {
  const activeMemberIds = state.members.map(m => m.memberId);
  const activeExpenses = state.expenses.filter(e => !e.isDeleted);
  const cancelledItemIds = new Set(
    state.bookings.filter(b => b.status === 'cancelled').map(b => b.itemId)
  );

  // Compute per-expense shares using existing engine
  const balances: Record<string, number> = {};
  activeMemberIds.forEach(id => { balances[id] = 0; });

  let totalSpent = 0;

  for (const exp of activeExpenses) {
    // Skip expenses tied to cancelled items
    if (exp.itemId && cancelledItemIds.has(exp.itemId)) continue;

    if (exp.splitType === 'organizer_paid') continue;

    totalSpent += exp.amount;

    // Payer gets credited
    balances[exp.paidByMemberId] = (balances[exp.paidByMemberId] ?? 0) + exp.amount;

    // Compute each participant's share
    const participants = exp.participantMemberIds.map(memberId => ({
      memberId,
      percentage: exp.percentages?.[memberId],
    }));

    const shares = computeShares({
      amount: exp.amount,
      splitType: exp.splitType,
      participants,
    });

    for (const [memberId, share] of Object.entries(shares)) {
      balances[memberId] = (balances[memberId] ?? 0) - share;
    }
  }

  // Factor in refunds
  let totalRefunded = 0;
  for (const refund of state.refunds) {
    totalRefunded += refund.amount;

    if (refund.isRedistributed && refund.distributions) {
      // Redistributed: each recipient gets their share
      for (const dist of refund.distributions) {
        balances[dist.memberId] = (balances[dist.memberId] ?? 0) + dist.amount;
      }
    } else {
      // Not yet redistributed: credit goes to whoever received the refund
      balances[refund.receivedByMemberId] = (balances[refund.receivedByMemberId] ?? 0) + refund.amount;
    }
  }

  // Factor in settlement payments already made
  let totalSettled = 0;
  for (const payment of state.payments) {
    totalSettled += payment.amount;
    balances[payment.fromMemberId] = (balances[payment.fromMemberId] ?? 0) + payment.amount;
    balances[payment.toMemberId] = (balances[payment.toMemberId] ?? 0) - payment.amount;
  }

  // Round all balances to avoid floating-point drift
  for (const id in balances) {
    balances[id] = Math.round(balances[id] * 100) / 100;
  }

  // Compute minimum settlements using existing engine
  const settlements = simplifyDebts(balances);

  return {
    ...state,
    balances,
    settlements,
    totalSpent,
    totalRefunded,
    totalSettled,
  };
}

// ─── Balance Trace: "Why Do I Owe This?" ────────────────────────────────────

/**
 * Generates a step-by-step trace of how a member's balance was computed.
 * Each event that affected this member's balance is listed with its impact.
 */
export function generateBalanceTrace(
  tripId: string,
  events: LedgerEvent[],
  memberId: string,
  activeConstitution?: FairnessRule[]
): BalanceTrace[] {
  const trace: BalanceTrace[] = [];
  let runningBalance = 0;
  let currentConstitution: FairnessRule[] = activeConstitution ?? [...DEFAULT_CONSTITUTION];

  // Track member join dates to know if late joiner rule applies
  const memberJoinDates = new Map<string, string>();
  for (const ev of events) {
    if (ev.type === 'PARTICIPANT_JOINED') {
      const p = ev.payload as any;
      if (p.memberId && (p.joinedAt || ev.timestamp)) {
        memberJoinDates.set(p.memberId, p.joinedAt || ev.timestamp);
      }
    }
  }

  for (const event of events) {
    let impact = 0;
    let description = '';
    let relevant = false;
    let applicableRule: {
      ruleNumber: number;
      ruleId: string;
      ruleName: string;
      citation: string;
    } | undefined = undefined;

    if (event.type === 'CONSTITUTION_UPDATED') {
      const p = event.payload as ConstitutionUpdatedPayload;
      if (p.rules) currentConstitution = p.rules;
    }

    switch (event.type) {
      case 'EXPENSE_ADDED': {
        const p = event.payload as ExpenseAddedPayload;
        if (p.splitType === 'organizer_paid') {
          const rule6 = currentConstitution.find(r => r.id === 'organizer_no_cancel_risk');
          if (rule6?.isEnabled && p.paidByMemberId === memberId) {
            applicableRule = {
              ruleNumber: rule6.ruleNumber,
              ruleId: rule6.id,
              ruleName: rule6.name,
              citation: `Under Rule ${rule6.ruleNumber} (${rule6.name}), organizer fronts deposits for "${p.note || 'booking'}" but does not automatically bear cancellation risk.`,
            };
          }
          break;
        }

        // Did they pay?
        if (p.paidByMemberId === memberId) {
          impact += p.amount;
          description = `Paid ₹${p.amount.toLocaleString('en-IN')} for "${p.note || 'expense'}"`;
          relevant = true;
        }

        // Are they a participant?
        if (p.participantMemberIds.includes(memberId)) {
          const shares = computeShares({
            amount: p.amount,
            splitType: p.splitType as SplitType,
            participants: p.participantMemberIds.map(id => ({
              memberId: id,
              percentage: p.percentages?.[id],
            })),
          });
          const myShare = shares[memberId] ?? 0;
          if (myShare > 0) {
            impact -= myShare;
            const shareDesc = `Share: ₹${myShare.toLocaleString('en-IN')} for "${p.note || 'expense'}"`;
            if (relevant) {
              description += ` | ${shareDesc}`;
            } else {
              description = shareDesc;
              relevant = true;
            }

            // Determine applicable rule for share calculation
            const memberJoinedAt = memberJoinDates.get(memberId);
            const expenseDate = event.timestamp;
            const rule1 = currentConstitution.find(r => r.id === 'late_joiner_no_prior_costs');
            if (rule1?.isEnabled && memberJoinedAt && new Date(memberJoinedAt) > new Date(expenseDate)) {
              applicableRule = {
                ruleNumber: rule1.ruleNumber,
                ruleId: rule1.id,
                ruleName: rule1.name,
                citation: `Under Rule ${rule1.ruleNumber} (${rule1.name}), late joiners do not share costs incurred before joining.`,
              };
            } else {
              applicableRule = {
                ruleNumber: 3,
                ruleId: 'group_cancel_shared_equally',
                ruleName: 'Group Shared Expense',
                citation: `Costs for "${p.note || 'booking'}" shared equally among ${p.participantMemberIds.length} members.`,
              };
            }
          }
        }
        break;
      }

      case 'EXPENSE_DELETED': {
        const p = event.payload as ExpenseDeletedPayload;
        if (p.originalPaidBy === memberId) {
          impact -= p.originalAmount;
          description = `Expense deleted (was ₹${p.originalAmount.toLocaleString('en-IN')})`;
          relevant = true;
        }
        break;
      }

      case 'PAYMENT_MADE': {
        const p = event.payload as PaymentMadePayload;
        if (p.fromMemberId === memberId) {
          impact += p.amount;
          description = `Settlement payment sent: ₹${p.amount.toLocaleString('en-IN')}`;
          relevant = true;
        }
        if (p.toMemberId === memberId) {
          impact -= p.amount;
          description = `Settlement payment received: ₹${p.amount.toLocaleString('en-IN')}`;
          relevant = true;
        }
        break;
      }

      case 'REFUND_RECEIVED': {
        const p = event.payload as RefundReceivedPayload;
        if (p.receivedByMemberId === memberId) {
          impact += p.amount;
          description = `Refund received: ₹${p.amount.toLocaleString('en-IN')} from ${p.vendorName || 'vendor'}`;
          relevant = true;
          const rule7 = currentConstitution.find(r => r.id === 'refund_to_funder');
          if (rule7?.isEnabled) {
            applicableRule = {
              ruleNumber: rule7.ruleNumber,
              ruleId: rule7.id,
              ruleName: rule7.name,
              citation: `Under Rule ${rule7.ruleNumber} (${rule7.name}), vendor refunds return to the people who economically funded the booking, not merely to the cardholder.`,
            };
          }
        }
        break;
      }

      case 'REFUND_REDISTRIBUTED': {
        const p = event.payload as RefundRedistributedPayload;
        const myDist = p.distributions.find(d => d.memberId === memberId);
        if (myDist) {
          impact += myDist.amount;
          description = `Refund redistribution: ₹${myDist.amount.toLocaleString('en-IN')}`;
          relevant = true;
          const rule7 = currentConstitution.find(r => r.id === 'refund_to_funder');
          if (rule7?.isEnabled) {
            applicableRule = {
              ruleNumber: rule7.ruleNumber,
              ruleId: rule7.id,
              ruleName: rule7.name,
              citation: `Under Rule ${rule7.ruleNumber} (${rule7.name}), vendor refund of ₹${myDist.amount.toLocaleString('en-IN')} returned to economic funder.`,
            };
          }
        }
        break;
      }

      case 'PARTICIPANT_LEFT': {
        const p = event.payload as any;
        if (p.memberId === memberId) {
          const rule2 = currentConstitution.find(r => r.id === 'voluntary_cancel_pays_loss');
          if (rule2?.isEnabled && p.nonRefundableLoss) {
            impact -= p.nonRefundableLoss;
            description = `Voluntary withdrawal loss: ₹${p.nonRefundableLoss.toLocaleString('en-IN')}`;
            relevant = true;
            applicableRule = {
              ruleNumber: rule2.ruleNumber,
              ruleId: rule2.id,
              ruleName: rule2.name,
              citation: `Under Rule ${rule2.ruleNumber} (${rule2.name}), voluntary withdrawal costs remain assigned to the withdrawing participant until a replacement joins.`,
            };
          }
        }
        break;
      }
    }

    if (relevant && impact !== 0) {
      runningBalance += impact;
      runningBalance = Math.round(runningBalance * 100) / 100;

      trace.push({
        eventId: event.id,
        eventType: event.type,
        timestamp: event.timestamp,
        description,
        impact: Math.round(impact * 100) / 100,
        runningBalance,
        applicableRule,
      });
    }
  }

  return trace;
}

// ─── What-If Support ────────────────────────────────────────────────────────

/**
 * Replays events with modifications for What-If analysis.
 * This is the foundation for Trip Fork — Phase 3 will build the full UI on top.
 *
 * @param events - The original event stream
 * @param modifications - Events to add, remove, or replace
 */
export function replayWithModifications(
  tripId: string,
  events: LedgerEvent[],
  modifications: {
    removeEventIds?: Set<string>;
    addEvents?: LedgerEvent[];
    replaceEvents?: Map<string, LedgerEvent>;
  }
): TripState {
  let modifiedStream = [...events];

  // Remove events
  if (modifications.removeEventIds) {
    modifiedStream = modifiedStream.filter(e => !modifications.removeEventIds!.has(e.id));
  }

  // Replace events
  if (modifications.replaceEvents) {
    modifiedStream = modifiedStream.map(e =>
      modifications.replaceEvents!.has(e.id)
        ? modifications.replaceEvents!.get(e.id)!
        : e
    );
  }

  // Add events and re-sort by version
  if (modifications.addEvents) {
    modifiedStream = [...modifiedStream, ...modifications.addEvents];
    modifiedStream.sort((a, b) => a.version - b.version);
  }

  return replayEvents(tripId, modifiedStream);
}
