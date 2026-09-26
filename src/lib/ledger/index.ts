// ─── Ledger Module: Public API ──────────────────────────────────────────────
// Single import point for all event-sourced ledger functionality.

// Event type definitions
export type {
  LedgerEvent,
  LedgerEventType,
  LedgerEventPayload,
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

// Type guards
export {
  isExpenseAdded,
  isExpenseDeleted,
  isParticipantJoined,
  isParticipantLeft,
  isBookingCreated,
  isBookingCancelled,
  isRefundReceived,
  isPaymentMade,
  isSplitChanged,
  isParticipantOptedOut,
  isParticipantOptedIn,
  isWhatIfForkApproved,
  isConstitutionUpdated,
} from './event-types';

// Event store (Firestore operations)
export {
  appendEvent,
  appendEvents,
  getEventStream,
  getEventsForItem,
  getEventsForMember,
  getCurrentVersion,
  getEventCount,
} from './event-store';

// Replay engine (state derivation)
export type {
  TripState,
  DerivedMember,
  DerivedBooking,
  DerivedExpense,
  DerivedPayment,
  DerivedRefund,
  BalanceTrace,
} from './replay-engine';

export {
  replayEvents,
  generateBalanceTrace,
  replayWithModifications,
} from './replay-engine';

// Dependency Graph
export type {
  GraphNode,
  GraphEdge,
  DependencyGraph,
  CascadeResult,
  CascadeImpact,
  BookingDependency,
} from './dependency-graph';

export {
  buildDependencyGraph,
  analyzeCascade,
} from './dependency-graph';

// What-If Counterfactual Engine
export type {
  WhatIfScenario,
  WhatIfComparison,
  MemberDiff,
  ScenarioRecommendation,
  MemberImpactSummary,
  InvalidBookingSummary,
  CheapestFairPlan,
  ChangeSimulationType,
  ParsedWhatIfQuery,
} from './what-if-engine';

export {
  generateMemberLeavesAfterDayScenarios,
  generateParticipantSkipsBookingScenarios,
  generatePrivateRoomsScenarios,
  generateHotelCancelsRoomScenarios,
  generateAirlineVouchersScenarios,
  generateSpendingCapScenarios,
  parseWhatIfQuery,
} from './what-if-engine';

// Shapley Value Calculator
export type {
  ShapleyAllocation,
  ShapleyBreakdown,
  ShapleyResult,
} from './shapley';

export {
  computeShapleyAllocations,
  compareAllocationMethods,
} from './shapley';

// Fairness Constitution
export type {
  FairnessRuleId,
  FairnessRule,
  RuleCitation,
} from './fairness-rules';

export {
  DEFAULT_CONSTITUTION,
  FairnessEngine,
  getDefaultFairnessEngine,
  generateRuleCitation,
} from './fairness-rules';
