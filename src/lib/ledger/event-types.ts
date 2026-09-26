// ─── Event-Sourced Ledger: Event Type Definitions ───────────────────────────
// Every mutation in GroupTrip is modeled as an immutable, append-only event.
// State is NEVER stored directly — it is always derived by replaying events.

// ─── Event Type Enum ────────────────────────────────────────────────────────

export type LedgerEventType =
  // Trip lifecycle
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  // Participants
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  // Bookings / Itinerary Items
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  // Expenses / Payments
  | 'EXPENSE_ADDED'
  | 'EXPENSE_DELETED'
  | 'PAYMENT_MADE'
  // Refunds
  | 'REFUND_RECEIVED'
  | 'REFUND_REDISTRIBUTED'
  // Split & participation changes
  | 'SPLIT_CHANGED'
  | 'PARTICIPANT_OPTED_OUT'
  | 'PARTICIPANT_OPTED_IN'
  // What-If Timeline Fork Milestones
  | 'WHAT_IF_FORK_APPROVED'
  // Fairness Constitution Updates
  | 'CONSTITUTION_UPDATED';

// ─── Event Payloads ─────────────────────────────────────────────────────────

export interface TripCreatedPayload {
  tripName: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: string; // user ID of creator
  inviteCode: string;
}

export interface TripUpdatedPayload {
  changes: Partial<{
    tripName: string;
    destination: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface ParticipantJoinedPayload {
  memberId: string;    // trip_members doc ID
  userId: string;      // auth user ID
  displayName: string;
}

export interface ParticipantLeftPayload {
  memberId: string;
  userId: string;
  displayName: string;
  reason: 'voluntary' | 'removed_by_organizer' | 'group_decision';
}

export interface BookingCreatedPayload {
  itemId: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'dining' | 'other';
  label: string;
  cost: number;
  currency: string;           // 'INR' by default
  defaultSplitType: 'equal' | 'flat_per_person' | 'per_night' | 'percentage' | 'organizer_paid';
  participantMemberIds: string[];
  startTime: string | null;
  endTime: string | null;
  vendorName?: string | null;
  cancellationPolicy?: string | null;
}

export interface BookingUpdatedPayload {
  itemId: string;
  changes: Partial<{
    label: string;
    cost: number;
    startTime: string;
    endTime: string;
    defaultSplitType: string;
    vendorName: string;
  }>;
  previousValues: Partial<{
    label: string;
    cost: number;
    startTime: string;
    endTime: string;
    defaultSplitType: string;
    vendorName: string;
  }>;
}

export interface BookingCancelledPayload {
  itemId: string;
  label: string;
  reason: string;
  refundAmount: number | null;    // expected refund, if known
  penaltyAmount: number | null;   // non-refundable portion
  cancelledBy: string;            // member ID
}

export interface ExpenseAddedPayload {
  expenseId: string;
  itemId: string | null;    // linked itinerary item, or null for general
  amount: number;
  currency: string;
  paidByMemberId: string;
  splitType: 'equal' | 'flat_per_person' | 'per_night' | 'percentage' | 'organizer_paid';
  participantMemberIds: string[];
  percentages?: Record<string, number>;   // only for 'percentage' split
  note: string | null;
  receiptUrl: string | null;
}

export interface ExpenseDeletedPayload {
  expenseId: string;
  originalAmount: number;
  originalPaidBy: string;
  reason: string;
}

export interface PaymentMadePayload {
  settlementId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  method: 'upi' | 'cash' | 'bank_transfer' | 'other';
  upiTransactionId?: string | null;
}

export interface RefundReceivedPayload {
  refundId: string;
  linkedItemId: string;       // which booking was refunded
  amount: number;
  currency: string;
  receivedByMemberId: string; // whose account/card got the refund
  vendorName: string | null;
  isFullRefund: boolean;
}

export interface RefundRedistributedPayload {
  refundId: string;
  distributions: { memberId: string; amount: number }[];
  rule: string;                // which fairness rule was applied
}

export interface SplitChangedPayload {
  itemId: string;
  previousSplitType: string;
  newSplitType: string;
  previousParticipants: string[];
  newParticipants: string[];
  reason: string;
}

export interface ParticipantOptedOutPayload {
  memberId: string;
  itemId: string;
  reason: string;
}

export interface ParticipantOptedInPayload {
  memberId: string;
  itemId: string;
}

export interface WhatIfForkApprovedPayload {
  forkId: string;
  scenarioName: string;
  proposalSummary: string;
  recommendation: string;
  totalGroupImpact: number;
  approvedByMemberId: string;
  priorVersion: number;
  changesApplied: string[];
}

export interface ConstitutionUpdatedPayload {
  rules: any[];
  updatedBy: string;
  reason?: string;
  rationale?: string;
  activeCount?: number;
}

// ─── Payload Union ──────────────────────────────────────────────────────────

export type LedgerEventPayload =
  | TripCreatedPayload
  | TripUpdatedPayload
  | ParticipantJoinedPayload
  | ParticipantLeftPayload
  | BookingCreatedPayload
  | BookingUpdatedPayload
  | BookingCancelledPayload
  | ExpenseAddedPayload
  | ExpenseDeletedPayload
  | PaymentMadePayload
  | RefundReceivedPayload
  | RefundRedistributedPayload
  | SplitChangedPayload
  | ParticipantOptedOutPayload
  | ParticipantOptedInPayload
  | WhatIfForkApprovedPayload
  | ConstitutionUpdatedPayload;

// ─── Core Event Structure ───────────────────────────────────────────────────
// Every event stored in Firestore follows this shape.
// Events are IMMUTABLE. Once written, they are never updated or deleted.

export interface LedgerEvent {
  id: string;                    // Firestore document ID
  tripId: string;
  type: LedgerEventType;
  timestamp: string;             // ISO 8601
  actorId: string;               // user ID of who triggered this
  version: number;               // monotonically increasing per trip
  payload: LedgerEventPayload;
  metadata?: {
    source?: 'web' | 'mobile' | 'api' | 'system';
    deviceInfo?: string;
    parentEventId?: string;      // for events caused by other events (cascading)
    whatIfBranch?: string | null; // null = real timeline, string = fork ID
  };
}

// ─── Type Guards ────────────────────────────────────────────────────────────
// Helper functions for safe payload access in the replay engine.

export function isExpenseAdded(e: LedgerEvent): e is LedgerEvent & { payload: ExpenseAddedPayload } {
  return e.type === 'EXPENSE_ADDED';
}

export function isExpenseDeleted(e: LedgerEvent): e is LedgerEvent & { payload: ExpenseDeletedPayload } {
  return e.type === 'EXPENSE_DELETED';
}

export function isParticipantJoined(e: LedgerEvent): e is LedgerEvent & { payload: ParticipantJoinedPayload } {
  return e.type === 'PARTICIPANT_JOINED';
}

export function isParticipantLeft(e: LedgerEvent): e is LedgerEvent & { payload: ParticipantLeftPayload } {
  return e.type === 'PARTICIPANT_LEFT';
}

export function isBookingCreated(e: LedgerEvent): e is LedgerEvent & { payload: BookingCreatedPayload } {
  return e.type === 'BOOKING_CREATED';
}

export function isBookingCancelled(e: LedgerEvent): e is LedgerEvent & { payload: BookingCancelledPayload } {
  return e.type === 'BOOKING_CANCELLED';
}

export function isRefundReceived(e: LedgerEvent): e is LedgerEvent & { payload: RefundReceivedPayload } {
  return e.type === 'REFUND_RECEIVED';
}

export function isPaymentMade(e: LedgerEvent): e is LedgerEvent & { payload: PaymentMadePayload } {
  return e.type === 'PAYMENT_MADE';
}

export function isSplitChanged(e: LedgerEvent): e is LedgerEvent & { payload: SplitChangedPayload } {
  return e.type === 'SPLIT_CHANGED';
}

export function isParticipantOptedOut(e: LedgerEvent): e is LedgerEvent & { payload: ParticipantOptedOutPayload } {
  return e.type === 'PARTICIPANT_OPTED_OUT';
}

export function isParticipantOptedIn(e: LedgerEvent): e is LedgerEvent & { payload: ParticipantOptedInPayload } {
  return e.type === 'PARTICIPANT_OPTED_IN';
}

export function isWhatIfForkApproved(e: LedgerEvent): e is LedgerEvent & { payload: WhatIfForkApprovedPayload } {
  return e.type === 'WHAT_IF_FORK_APPROVED';
}

export function isConstitutionUpdated(e: LedgerEvent): e is LedgerEvent & { payload: ConstitutionUpdatedPayload } {
  return e.type === 'CONSTITUTION_UPDATED';
}
