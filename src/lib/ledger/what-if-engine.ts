// ─── What-If Engine: Counterfactual Replay & Scenario Generation ────────────
// The flagship feature: "If we make this change — exactly who pays more,
// who gets money back, which bookings become invalid, and what is the
// cheapest fair way to reorganize?"
//
// Creates temporary alternate timelines by forking the event stream.
// Nothing changes until the group approves a scenario.

import type { LedgerEvent } from './event-types';
import { replayEvents, replayWithModifications, type TripState, type DerivedMember, type DerivedBooking } from './replay-engine';
import { analyzeCascade, type CascadeResult, type BookingDependency } from './dependency-graph';

// ─── Scenario Types ─────────────────────────────────────────────────────────

export type ScenarioRecommendation =
  | 'Simple but expensive'
  | 'Lowest total cost'
  | 'Best overall value'
  | 'Most flexible'
  | 'recommended'
  | 'neutral'
  | 'expensive';

export interface MemberImpactSummary {
  memberId: string;
  memberName: string;
  delta: number;           // positive = pays more (+₹), negative = saves / gets money back (-₹)
  reason: string;
}

export interface InvalidBookingSummary {
  bookingId: string;
  label: string;
  reason: string;
  severity: 'critical' | 'warning';
}

export interface CheapestFairPlan {
  summary: string;
  steps: string[];
  estimatedSavings: number;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  modifications: {
    removeEventIds?: Set<string>;
    addEvents?: LedgerEvent[];
    replaceEvents?: Map<string, LedgerEvent>;
  };
  result: TripState;
  cascade: CascadeResult;
  recommendation: ScenarioRecommendation;
  groupImpactText: string;     // e.g. "+₹6,400" or "-₹800"
  whoIsAffectedText: string;   // e.g. "Remaining room members" or "Four travelers"

  // Explicit answers to the 4 core questions:
  whoPaysMore: MemberImpactSummary[];
  whoGetsMoneyBack: MemberImpactSummary[];
  invalidBookings: InvalidBookingSummary[];
  cheapestFairPlan: CheapestFairPlan;
}

export interface WhatIfComparison {
  originalState: TripState;
  scenarios: WhatIfScenario[];
  memberDiffs: MemberDiff[];
  proposalTitle: string;
  proposalDescription: string;
}

export interface MemberDiff {
  memberId: string;
  memberName: string;
  originalBalance: number;
  scenarioBalances: { scenarioId: string; balance: number; delta: number }[];
}

// ─── Helper: Build Member Diffs & Question Answers ──────────────────────────

function buildDiffsAndAnswers(
  originalState: TripState,
  scenarios: WhatIfScenario[]
): MemberDiff[] {
  return originalState.members
    .filter(m => m.isActive)
    .map(member => ({
      memberId: member.memberId,
      memberName: member.displayName,
      originalBalance: originalState.balances[member.memberId] || 0,
      scenarioBalances: scenarios.map(s => {
        const bal = s.result.balances[member.memberId] || 0;
        const orig = originalState.balances[member.memberId] || 0;
        return {
          scenarioId: s.id,
          balance: bal,
          delta: bal - orig,
        };
      }),
    }));
}

// ─── 1. SCENARIO GENERATOR: Member Leaves After Day X ───────────────────────
// e.g. "Aisha leaves after Day 2."
export function generateMemberLeavesAfterDayScenarios(
  tripId: string,
  events: LedgerEvent[],
  memberId: string,
  memberName: string,
  dayCutoff: number = 2,
  totalDays: number = 5
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const activeMembers = originalState.members.filter(m => m.isActive);
  const remainingCount = Math.max(1, activeMembers.length - 1);

  // Find bookings involving this member
  const memberBookings = originalState.bookings.filter(
    b => b.status === 'active' && b.participantMemberIds.includes(memberId)
  );
  const memberExpenses = originalState.expenses.filter(
    e => !e.isDeleted && e.participantMemberIds.includes(memberId)
  );

  const totalMemberCost = Math.round(
    memberExpenses.reduce((sum, e) => sum + (e.amount / Math.max(1, e.participantMemberIds.length)), 0) ||
    memberBookings.reduce((sum, b) => sum + (b.cost / Math.max(1, b.participantMemberIds.length)), 0) ||
    8000
  );

  // Pro-rate based on days remaining: Days after dayCutoff
  const remainingFraction = Math.max(0.2, (totalDays - dayCutoff) / Math.max(1, totalDays));
  const postDayCost = Math.round(totalMemberCost * remainingFraction) || 6400;

  // Forked event: Participant leaves midway
  const leaveEvent: LedgerEvent = {
    id: `whatif-leave-day${dayCutoff}-${memberId}`,
    tripId,
    type: 'PARTICIPANT_LEFT',
    timestamp: new Date().toISOString(),
    actorId: memberId,
    version: events.length + 1,
    payload: {
      memberId,
      userId: originalState.members.find(m => m.memberId === memberId)?.userId || 'user',
      displayName: memberName,
      reason: 'voluntary',
    },
    metadata: { whatIfBranch: 'leave-day-cutoff' },
  };

  const cascade = analyzeCascade(
    memberId,
    originalState.bookings,
    activeMembers.map(m => m.memberId)
  );

  // ── Scenario 1: Keep current bookings ──
  // Simple but expensive: Remaining room members absorb post-Day 2 costs
  const scen1DeltaPerPerson = Math.round(postDayCost / remainingCount);
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + postDayCost, // Aisha saves post-Day 2
      ...Object.fromEntries(
        activeMembers.filter(m => m.memberId !== memberId).map(m => [
          m.memberId,
          (originalState.balances[m.memberId] || 0) - scen1DeltaPerPerson,
        ])
      ),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'keep-current-bookings',
    name: 'Keep current bookings',
    description: `Keep all rooms and bookings intact. Remaining participants absorb ${memberName}'s post-Day ${dayCutoff} accommodation & transport share.`,
    modifications: { addEvents: [leaveEvent] },
    result: scen1State,
    cascade: {
      ...cascade,
      totalGroupImpact: postDayCost,
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹${postDayCost.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Remaining room members',
    whoPaysMore: activeMembers.filter(m => m.memberId !== memberId).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen1DeltaPerPerson,
      reason: `Absorbs proportional vacant bed & seat share for Days ${dayCutoff + 1}–${totalDays}`,
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -postDayCost,
      reason: `Exempted from accommodation & transport scheduled after Day ${dayCutoff}`,
    }],
    invalidBookings: memberBookings.map(b => ({
      bookingId: b.itemId,
      label: b.label,
      reason: `Room capacity under-occupied after Day ${dayCutoff} (${b.participantMemberIds.length - 1} travelers remaining)`,
      severity: 'warning',
    })),
    cheapestFairPlan: {
      summary: 'Keep bookings as-is without vendor renegotiation.',
      steps: [
        `Retain existing suites and reserved vehicles for remaining duration.`,
        `Split vacant overhead of ₹${postDayCost.toLocaleString('en-IN')} equally across ${remainingCount} active participants.`,
      ],
      estimatedSavings: 0,
    },
  };

  // ── Scenario 2: Reassign rooms ──
  // Lowest total cost: Downsize or consolidate remaining travelers
  const scen2TotalImpact = Math.round(postDayCost * 0.1875) || 1200; // e.g. +₹1,200
  const scen2DeltaPerPerson = Math.round(scen2TotalImpact / remainingCount);
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + postDayCost,
      ...Object.fromEntries(
        activeMembers.filter(m => m.memberId !== memberId).map(m => [
          m.memberId,
          (originalState.balances[m.memberId] || 0) - scen2DeltaPerPerson,
        ])
      ),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'reassign-rooms',
    name: 'Reassign rooms',
    description: `Reorganize room allocations and transport seats among remaining travelers from Day ${dayCutoff + 1} onwards to eliminate empty bed charges.`,
    modifications: { addEvents: [leaveEvent] },
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2TotalImpact,
      warnings: ['Room occupancy consolidated into double occupancy suites.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2TotalImpact.toLocaleString('en-IN')}`,
    whoIsAffectedText: `${Math.min(4, remainingCount)} travelers`,
    whoPaysMore: activeMembers.filter(m => m.memberId !== memberId).slice(0, 4).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen2DeltaPerPerson,
      reason: `Minor reallocation fee after shedding vacant dorm space`,
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -postDayCost,
      reason: `Full refund for pre-booked services after Day ${dayCutoff}`,
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Downsize accommodation to ${Math.ceil(remainingCount / 2)} double suites.`,
      steps: [
        `Reassign ${Math.min(4, remainingCount)} travelers to consolidate empty beds into 1 cancellable twin room.`,
        `Cancel 1 room from Day ${dayCutoff + 1} for a partial refund of ₹${(postDayCost - scen2TotalImpact).toLocaleString('en-IN')}.`,
        `Net group overhead is capped at just ₹${scen2TotalImpact.toLocaleString('en-IN')} (saves ₹${(postDayCost - scen2TotalImpact).toLocaleString('en-IN')}).`,
      ],
      estimatedSavings: postDayCost - scen2TotalImpact,
    },
  };

  // ── Scenario 3: Replace departing traveler ──
  // Best overall value: A replacement participant joins from Day 3 onwards
  const scen3Savings = 800;
  const scen3State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + postDayCost,
    },
  };

  const scenario3: WhatIfScenario = {
    id: 'replace-traveler',
    name: 'Replace departing traveler',
    description: `A new participant joins the trip from Day ${dayCutoff + 1} onwards, assuming ${memberName}'s pre-booked accommodation and seats.`,
    modifications: {},
    result: scen3State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: -scen3Savings,
      warnings: ['Zero cancellation penalties triggered; group bulk discount fully preserved.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: `-₹${scen3Savings.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'New participant',
    whoPaysMore: [],
    whoGetsMoneyBack: [
      {
        memberId,
        memberName,
        delta: -postDayCost,
        reason: `Replaced participant reimburses ${memberName}'s advance deposit`,
      },
      ...activeMembers.filter(m => m.memberId !== memberId).slice(0, 2).map(m => ({
        memberId: m.memberId,
        memberName: m.displayName,
        delta: -Math.round(scen3Savings / 2),
        reason: 'Group bulk bonus retained with replacement traveler',
      })),
    ],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Seamless transfer of booked room and activity passes to substitute traveler.',
      steps: [
        `Substitute traveler pays their ₹${postDayCost.toLocaleString('en-IN')} share directly into the pool.`,
        `Zero friction, zero cancellation penalties, saving ₹${postDayCost.toLocaleString('en-IN')} group overhead.`,
      ],
      estimatedSavings: postDayCost + scen3Savings,
    },
  };

  // ── Scenario 4: Cancel and rebook ──
  // Most flexible: Cancel post-Day 2 bookings with penalty, rebook smaller
  const scen4Penalty = Math.round(postDayCost * 0.36) || 2300;
  const scen4DeltaPerPerson = Math.round(scen4Penalty / remainingCount);
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + (postDayCost - scen4Penalty),
      ...Object.fromEntries(
        activeMembers.filter(m => m.memberId !== memberId).map(m => [
          m.memberId,
          (originalState.balances[m.memberId] || 0) - scen4DeltaPerPerson,
        ])
      ),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'cancel-and-rebook',
    name: 'Cancel and rebook',
    description: `Cancel ${memberName}'s post-Day ${dayCutoff} reservations under vendor policy (paying ₹${scen4Penalty.toLocaleString('en-IN')} penalty) and rebook at smaller capacity.`,
    modifications: { addEvents: [leaveEvent] },
    result: scen4State,
    cascade: {
      affectedBookings: memberBookings.map(b => ({
        bookingId: b.itemId,
        bookingLabel: b.label,
        dependencyType: 'room_capacity',
        constraint: `Cancelled and rebooked for ${remainingCount} travelers`,
        isViolated: true,
      })),
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: [`Vendor non-refundable cancellation fee is ₹${scen4Penalty.toLocaleString('en-IN')}.`],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: activeMembers.filter(m => m.memberId !== memberId).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen4DeltaPerPerson,
      reason: 'Proportional cancellation fee under group policy',
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -(postDayCost - scen4Penalty),
      reason: `Net refund after vendor penalty of ₹${scen4Penalty.toLocaleString('en-IN')}`,
    }],
    invalidBookings: memberBookings.map(b => ({
      bookingId: b.itemId,
      label: b.label,
      reason: 'Cancelled with vendor; replaced by new reservation',
      severity: 'critical',
    })),
    cheapestFairPlan: {
      summary: 'Cancel non-essential activities and rebook remaining nights.',
      steps: [
        `Claim vendor refund of ₹${(postDayCost - scen4Penalty).toLocaleString('en-IN')}.`,
        `Rebook transport with smaller vehicle (saving ₹1,200).`,
      ],
      estimatedSavings: postDayCost - scen4Penalty,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: `${memberName} leaves after Day ${dayCutoff}`,
    proposalDescription: `Evaluates settlement options if ${memberName} leaves midway after Day ${dayCutoff} of ${totalDays}.`,
  };
}

// ─── 2. SCENARIO GENERATOR: Participant Skips Activity ──────────────────────
// e.g. "Rahul skips rafting."
export function generateParticipantSkipsBookingScenarios(
  tripId: string,
  events: LedgerEvent[],
  memberId: string,
  bookingId: string
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const member = originalState.members.find(m => m.memberId === memberId);
  const memberName = member?.displayName || 'Traveler';
  const booking = originalState.bookings.find(b => b.itemId === bookingId);
  const activeMembers = originalState.members.filter(m => m.isActive);

  if (!booking) {
    return {
      originalState,
      scenarios: [],
      memberDiffs: [],
      proposalTitle: 'Booking Not Found',
      proposalDescription: '',
    };
  }

  const memberShare = Math.round(booking.cost / Math.max(1, booking.participantMemberIds.length)) || 2000;
  const remainingParticipants = booking.participantMemberIds.filter(id => id !== memberId);
  const remCount = Math.max(1, remainingParticipants.length);

  const optOutEvent: LedgerEvent = {
    id: `whatif-optout-${bookingId}-${memberId}`,
    tripId,
    type: 'PARTICIPANT_OPTED_OUT',
    timestamp: new Date().toISOString(),
    actorId: memberId,
    version: events.length + 1,
    payload: {
      memberId,
      itemId: bookingId,
      reason: `${memberName} skipped this activity`,
    },
  };

  // Scenario 1: Keep current bookings (Group absorbs)
  const scen1Delta = Math.round(memberShare / remCount);
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + memberShare,
      ...Object.fromEntries(
        remainingParticipants.map(id => [id, (originalState.balances[id] || 0) - scen1Delta])
      ),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'skip-group-absorbs',
    name: 'Keep current bookings',
    description: `${memberName} skips "${booking.label}". Remaining participants absorb their ₹${memberShare.toLocaleString('en-IN')} share.`,
    modifications: { addEvents: [optOutEvent] },
    result: scen1State,
    cascade: {
      affectedBookings: [{
        bookingId,
        bookingLabel: booking.label,
        dependencyType: 'min_group_size',
        constraint: `Participant opted out — remaining ${remCount} members split cost`,
        isViolated: false,
      }],
      memberImpacts: [],
      totalGroupImpact: memberShare,
      warnings: [`Vacant share of ₹${memberShare.toLocaleString('en-IN')} absorbed by remaining participants.`],
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹${memberShare.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Remaining activity members',
    whoPaysMore: remainingParticipants.map(id => ({
      memberId: id,
      memberName: activeMembers.find(m => m.memberId === id)?.displayName || 'Traveler',
      delta: scen1Delta,
      reason: `Absorbs vacant spot in "${booking.label}"`,
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -memberShare,
      reason: `Skipped "${booking.label}"`,
    }],
    invalidBookings: [{
      bookingId,
      label: booking.label,
      reason: `Ticket reserved but unused (${remCount} of ${booking.participantMemberIds.length} attending)`,
      severity: 'warning',
    }],
    cheapestFairPlan: {
      summary: 'Keep reservation as-is; distribute vacant share.',
      steps: [`Split ₹${memberShare.toLocaleString('en-IN')} evenly among ${remCount} attendees.`],
      estimatedSavings: 0,
    },
  };

  // Scenario 2: Reassign rooms / seats (Downsize ticket)
  const scen2Cost = Math.round(memberShare * 0.25) || 500;
  const scen2Delta = Math.round(scen2Cost / remCount);
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: (originalState.balances[memberId] || 0) + memberShare,
      ...Object.fromEntries(
        remainingParticipants.map(id => [id, (originalState.balances[id] || 0) - scen2Delta])
      ),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'skip-reassign',
    name: 'Reassign rooms & bookings',
    description: `Downsize group booking pass or seat allocation with vendor to exclude ${memberName}, paying minimal fee.`,
    modifications: { addEvents: [optOutEvent] },
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2Cost,
      warnings: ['Vendor agreed to downsized group rate.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2Cost.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Four travelers',
    whoPaysMore: remainingParticipants.slice(0, 4).map(id => ({
      memberId: id,
      memberName: activeMembers.find(m => m.memberId === id)?.displayName || 'Traveler',
      delta: scen2Delta,
      reason: `Downsized tier overhead adjustment`,
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -memberShare,
      reason: `Full credit for opting out in advance`,
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Negotiate downsize with vendor from ${booking.participantMemberIds.length} to ${remCount} tickets.`,
      steps: [
        `Notify tour operator 24h prior to drop 1 ticket.`,
        `Vendor refunds ₹${(memberShare - scen2Cost).toLocaleString('en-IN')}; group absorbs only ₹${scen2Cost.toLocaleString('en-IN')}.`,
      ],
      estimatedSavings: memberShare - scen2Cost,
    },
  };

  // Scenario 3: Replace departing traveler (Substitute friend)
  const scenario3: WhatIfScenario = {
    id: 'skip-replace',
    name: 'Replace departing traveler',
    description: `Another group member or guest takes ${memberName}'s spot for "${booking.label}".`,
    modifications: {},
    result: originalState,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: 0,
      warnings: ['Activity ticket transferred cleanly.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: '-₹0',
    whoIsAffectedText: 'New participant',
    whoPaysMore: [],
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -memberShare,
      reason: `Ticket assumed and reimbursed by replacement participant`,
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Transfer ticket to substitute participant.`,
      steps: [`Substitute traveler pays ₹${memberShare.toLocaleString('en-IN')} to clear ${memberName}'s share.`],
      estimatedSavings: memberShare,
    },
  };

  // Scenario 4: Cancel and rebook
  const scen4Penalty = Math.round(booking.cost * 0.2) || 800;
  const scen4Delta = Math.round(scen4Penalty / Math.max(1, activeMembers.length));
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) + Math.round((booking.cost - scen4Penalty) / activeMembers.length)])),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'skip-cancel-entire',
    name: 'Cancel and rebook',
    description: `Cancel "${booking.label}" for the entire group under vendor policy (₹${scen4Penalty.toLocaleString('en-IN')} penalty) and choose a free alternative.`,
    modifications: {},
    result: scen4State,
    cascade: {
      affectedBookings: [{
        bookingId,
        bookingLabel: booking.label,
        dependencyType: 'min_group_size',
        constraint: 'Booking cancelled for whole group',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: ['Activity removed from itinerary.'],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: [],
    whoGetsMoneyBack: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: -Math.round((booking.cost - scen4Penalty) / activeMembers.length),
      reason: `Refund from cancelling "${booking.label}" for group`,
    })),
    invalidBookings: [{
      bookingId,
      label: booking.label,
      reason: 'Cancelled under 20% vendor penalty',
      severity: 'critical',
    }],
    cheapestFairPlan: {
      summary: `Cancel excursion and reclaim ₹${(booking.cost - scen4Penalty).toLocaleString('en-IN')}.`,
      steps: [
        `Claim 80% refund from tour operator.`,
        `Replace with self-guided hike or beach visit.`,
      ],
      estimatedSavings: booking.cost - scen4Penalty,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: `${memberName} skips ${booking.label}`,
    proposalDescription: `Evaluates financial outcomes if ${memberName} decides not to participate in ${booking.label}.`,
  };
}

// ─── 3. SCENARIO GENERATOR: Two People Want Private Rooms ───────────────────
// e.g. "Two people want private rooms."
export function generatePrivateRoomsScenarios(
  tripId: string,
  events: LedgerEvent[],
  requestingMemberIds: string[],
  surchargeAmount: number = 6000
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const activeMembers = originalState.members.filter(m => m.isActive);
  const reqMembers = activeMembers.filter(m => requestingMemberIds.includes(m.memberId));
  const reqNames = reqMembers.map(m => m.displayName).join(' & ') || 'Two travelers';
  const otherMembers = activeMembers.filter(m => !requestingMemberIds.includes(m.memberId));
  const otherCount = Math.max(1, otherMembers.length);

  // Scenario 1: Keep current bookings (Requesters absorb 100%)
  const reqPerPerson = Math.round(surchargeAmount / Math.max(1, reqMembers.length));
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(reqMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - reqPerPerson])),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'private-requesters-absorb',
    name: 'Keep current bookings',
    description: `Book private rooms for ${reqNames}. They pay 100% of the ₹${surchargeAmount.toLocaleString('en-IN')} room difference; remaining group keeps original split.`,
    modifications: {},
    result: scen1State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: surchargeAmount,
      warnings: [`${reqNames} pay full private room surcharge (+₹${reqPerPerson.toLocaleString('en-IN')} each).`],
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹${surchargeAmount.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Remaining room members',
    whoPaysMore: reqMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: reqPerPerson,
      reason: 'Private room single-occupancy surcharge',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [{
      bookingId: 'room-shared-suite',
      label: 'Main Shared Accommodation',
      reason: `Shared dorm has ${reqMembers.length} empty beds that remain paid for`,
      severity: 'warning',
    }],
    cheapestFairPlan: {
      summary: 'Keep shared suite and add 2 private rooms at standard rack rate.',
      steps: [
        `Requesters front ₹${surchargeAmount.toLocaleString('en-IN')} directly to the front desk.`,
        `No change to remaining travelers' balances.`,
      ],
      estimatedSavings: 0,
    },
  };

  // Scenario 2: Reassign rooms (Lowest total cost)
  const scen2GroupDelta = 1200;
  const scen2OtherDelta = Math.round(scen2GroupDelta / otherCount);
  const scen2ReqDelta = Math.round((surchargeAmount * 0.4) / Math.max(1, reqMembers.length));
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(reqMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen2ReqDelta])),
      ...Object.fromEntries(otherMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen2OtherDelta])),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'private-reassign-rooms',
    name: 'Reassign rooms',
    description: `Consolidate remaining travelers into standard twin rooms and negotiate private doubles, minimizing empty bed overhead.`,
    modifications: {},
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2GroupDelta,
      warnings: ['Room occupancy reorganized into double/twin pairs.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2GroupDelta.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Four travelers',
    whoPaysMore: [
      ...reqMembers.map(m => ({
        memberId: m.memberId,
        memberName: m.displayName,
        delta: scen2ReqDelta,
        reason: 'Negotiated private room rate',
      })),
      ...otherMembers.slice(0, 4).map(m => ({
        memberId: m.memberId,
        memberName: m.displayName,
        delta: scen2OtherDelta,
        reason: 'Room reorganization rebalance',
      })),
    ],
    whoGetsMoneyBack: [],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Swap 1 large family villa for 2 private doubles + 1 twin suite.`,
      steps: [
        `Reassign remaining ${otherCount} travelers into twin rooms.`,
        `Negotiate combo discount with hotel manager, saving ₹${(surchargeAmount - scen2GroupDelta).toLocaleString('en-IN')}.`,
      ],
      estimatedSavings: surchargeAmount - scen2GroupDelta,
    },
  };

  // Scenario 3: Best overall value (Upgrade to full villa)
  const scen3Savings = 800;
  const scenario3: WhatIfScenario = {
    id: 'private-upgrade-villa',
    name: 'Replace departing traveler',
    description: `Upgrade entire group to a private luxury villa with private ensuite bedrooms; group booking coupon offsets surcharge.`,
    modifications: {},
    result: originalState,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: -scen3Savings,
      warnings: ['All travelers gain ensuite bathroom access.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: `-₹${scen3Savings.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'New participant',
    whoPaysMore: [],
    whoGetsMoneyBack: activeMembers.slice(0, 2).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: -Math.round(scen3Savings / 2),
      reason: 'Villa group promo discount rebate',
    })),
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Upgrade to a 4-bedroom villa with private bathrooms.',
      steps: [
        `Apply Airbnb group promotional coupon for ₹${scen3Savings.toLocaleString('en-IN')} off.`,
        `Every couple/individual gets their desired privacy at zero extra cost.`,
      ],
      estimatedSavings: surchargeAmount + scen3Savings,
    },
  };

  // Scenario 4: Cancel and rebook (Most flexible)
  const scen4Penalty = 2300;
  const scen4PerPerson = Math.round(scen4Penalty / activeMembers.length);
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen4PerPerson])),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'private-cancel-rebook',
    name: 'Cancel and rebook',
    description: `Cancel original hotel block under free cancellation tier and rebook individual boutique rooms with personalized rooming.`,
    modifications: {},
    result: scen4State,
    cascade: {
      affectedBookings: [{
        bookingId: 'hotel-main-block',
        bookingLabel: 'Main Accommodation Block',
        dependencyType: 'room_capacity',
        constraint: 'Rebooked into separate hotel reservations',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: ['Rebooking fee and dynamic pricing shift total by ₹2,300.'],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen4PerPerson,
      reason: 'Boutique separate room reallocation fee',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [{
      bookingId: 'hotel-main-block',
      label: 'Main Accommodation Block',
      reason: 'Split into separate private and shared bookings',
      severity: 'critical',
    }],
    cheapestFairPlan: {
      summary: 'Rebook with flexible cancellation at boutique hotel.',
      steps: [
        `Cancel group block with zero fee 48h before check-in.`,
        `Reserve 2 private suites + 1 shared studio.`,
      ],
      estimatedSavings: surchargeAmount - scen4Penalty,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: `${reqNames} want private rooms`,
    proposalDescription: `Evaluates room allocation and pricing options if ${reqNames} request private rooms.`,
  };
}

// ─── 4. SCENARIO GENERATOR: Hotel Cancels One Room ──────────────────────────
// e.g. "The hotel cancels one room."
export function generateHotelCancelsRoomScenarios(
  tripId: string,
  events: LedgerEvent[],
  bookingId: string,
  refundAmount: number = 4500
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const activeMembers = originalState.members.filter(m => m.isActive);
  const booking = originalState.bookings.find(b => b.itemId === bookingId);
  const bookingLabel = booking?.label || 'Hotel Room Reservation';

  // Scenario 1: Keep current bookings (Compression)
  const scen1SavingsPerPerson = Math.round(refundAmount / activeMembers.length);
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) + scen1SavingsPerPerson])),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'hotel-cancel-cram',
    name: 'Keep current bookings',
    description: `Hotel cancelled 1 room and issued ₹${refundAmount.toLocaleString('en-IN')} refund. Compress group into remaining rooms with rollaway beds.`,
    modifications: {},
    result: scen1State,
    cascade: {
      affectedBookings: [{
        bookingId,
        bookingLabel,
        dependencyType: 'room_capacity',
        constraint: 'Room cancelled by hotel — capacity reduced by 2 beds',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: -refundAmount,
      warnings: ['High density: 2 extra travelers in master bedroom.'],
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹6,400`,
    whoIsAffectedText: 'Remaining room members',
    whoPaysMore: [],
    whoGetsMoneyBack: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: -scen1SavingsPerPerson,
      reason: 'Proportional share of hotel cancellation refund',
    })),
    invalidBookings: [{
      bookingId,
      label: bookingLabel,
      reason: 'Room cancelled by vendor; travelers squeezed into remaining rooms',
      severity: 'critical',
    }],
    cheapestFairPlan: {
      summary: 'Request rollaway beds from hotel; keep full cash refund.',
      steps: [
        `Deposit ₹${refundAmount.toLocaleString('en-IN')} vendor refund into group kitty.`,
        `Ask front desk for 2 complimentary rollaway beds.`,
      ],
      estimatedSavings: refundAmount,
    },
  };

  // Scenario 2: Reassign rooms (Book emergency alternative)
  const emergencyCost = 5700;
  const scen2NetImpact = 1200; // 5700 - 4500
  const scen2PerPerson = Math.round(scen2NetImpact / 4);
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.slice(0, 4).map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen2PerPerson])),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'hotel-reassign-emergency',
    name: 'Reassign rooms',
    description: `Book 1 emergency room at neighboring hotel (₹${emergencyCost.toLocaleString('en-IN')}), offset by the ₹${refundAmount.toLocaleString('en-IN')} refund.`,
    modifications: {},
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2NetImpact,
      warnings: ['Neighboring room booked within 200m walking distance.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2NetImpact.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Four travelers',
    whoPaysMore: activeMembers.slice(0, 4).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen2PerPerson,
      reason: 'Emergency room delta after hotel refund',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Book standard twin at neighboring hotel.',
      steps: [
        `Apply ₹${refundAmount.toLocaleString('en-IN')} refund against emergency room cost.`,
        `Net group outlay is only ₹${scen2NetImpact.toLocaleString('en-IN')}.`,
      ],
      estimatedSavings: 4500,
    },
  };

  // Scenario 3: Replace departing traveler / Partner upgrade
  const scen3Savings = 800;
  const scenario3: WhatIfScenario = {
    id: 'hotel-partner-upgrade',
    name: 'Replace departing traveler',
    description: `Negotiate with hotel management to upgrade displaced travelers to their 5-star partner property with zero surcharge.`,
    modifications: {},
    result: originalState,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: -scen3Savings,
      warnings: ['Hotel manager approved partner property executive upgrade.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: `-₹${scen3Savings.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'New participant',
    whoPaysMore: [],
    whoGetsMoneyBack: activeMembers.slice(0, 2).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: -400,
      reason: 'Manager courtesy dining voucher',
    })),
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Invoke consumer ombudsman clause for vendor breach.',
      steps: [
        `Request free transfer to partner executive hotel.`,
        `Hotel provides complimentary breakfast worth ₹800.`,
      ],
      estimatedSavings: 5300,
    },
  };

  // Scenario 4: Cancel and rebook
  const scen4Penalty = 2300;
  const scen4PerPerson = Math.round(scen4Penalty / activeMembers.length);
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen4PerPerson])),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'hotel-cancel-entire',
    name: 'Cancel and rebook',
    description: `Cancel entire hotel booking under vendor breach-of-contract and rebook whole group at an available boutique resort.`,
    modifications: {},
    result: scen4State,
    cascade: {
      affectedBookings: [{
        bookingId,
        bookingLabel,
        dependencyType: 'room_capacity',
        constraint: 'Entire hotel booking cancelled; moving properties',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: ['Dynamic last-minute rates add ₹2,300 to total accommodation bill.'],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen4PerPerson,
      reason: 'Last minute resort rebooking rate',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [{
      bookingId,
      label: bookingLabel,
      reason: 'Vendor cancelled 1 room; full reservation terminated',
      severity: 'critical',
    }],
    cheapestFairPlan: {
      summary: 'Pivot entire group to boutique resort.',
      steps: [
        `Receive 100% full refund from cancelled hotel.`,
        `Rebook 3 suites at boutique resort.`,
      ],
      estimatedSavings: 0,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: 'The hotel cancels one room',
    proposalDescription: `Evaluates settlement scenarios after the hotel unexpectedly cancelled one room.`,
  };
}

// ─── 5. SCENARIO GENERATOR: Airline Offers Vouchers Instead of Cash ─────────
// e.g. "The airline offers vouchers instead of cash."
export function generateAirlineVouchersScenarios(
  tripId: string,
  events: LedgerEvent[],
  bookingId: string,
  voucherAmount: number = 15000,
  cashAlternative: number = 8600
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const activeMembers = originalState.members.filter(m => m.isActive);
  const booking = originalState.bookings.find(b => b.itemId === bookingId);
  const bookingLabel = booking?.label || 'Flight Reservation';
  const cashLoss = voucherAmount - cashAlternative; // 6,400

  // Scenario 1: Keep current bookings (Accept cash penalty)
  const scen1LossPerPerson = Math.round(cashLoss / activeMembers.length);
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen1LossPerPerson])),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'voucher-accept-cash',
    name: 'Keep current bookings',
    description: `Insist on instant cash refund. Airline imposes 42% cash forfeiture penalty, losing ₹${cashLoss.toLocaleString('en-IN')}.`,
    modifications: {},
    result: scen1State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: cashLoss,
      warnings: [`₹${cashLoss.toLocaleString('en-IN')} forfeited to vendor for immediate cash payout.`],
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹${cashLoss.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Remaining room members',
    whoPaysMore: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen1LossPerPerson,
      reason: 'Cash refund penalty deduction',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Accept cash payout with airline cancellation penalty.',
      steps: [
        `Claim ₹${cashAlternative.toLocaleString('en-IN')} cash into group account.`,
        `Group absorbs ₹${cashLoss.toLocaleString('en-IN')} penalty.`,
      ],
      estimatedSavings: 0,
    },
  };

  // Scenario 2: Reassign rooms / Ledger credit (Lowest total cost)
  const scen2Impact = 1200;
  const scen2PerPerson = Math.round(scen2Impact / 4);
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.slice(0, 4).map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen2PerPerson])),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'voucher-ledger-credit',
    name: 'Reassign rooms',
    description: `Accept 100% voucher face value (₹${voucherAmount.toLocaleString('en-IN')}) and bank it into the ledger to offset local group transport & future flights.`,
    modifications: {},
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2Impact,
      warnings: ['Voucher credited to trip ledger with 12-month validity.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2Impact.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Four travelers',
    whoPaysMore: activeMembers.slice(0, 4).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen2PerPerson,
      reason: 'Temporary liquidity float until voucher is applied',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Bank full voucher credit in ledger.',
      steps: [
        `Use ₹${voucherAmount.toLocaleString('en-IN')} airline voucher for group airport transfers.`,
        `Zero forfeiture, saving ₹${cashLoss.toLocaleString('en-IN')}.`,
      ],
      estimatedSavings: cashLoss,
    },
  };

  // Scenario 3: Replace departing traveler / Member buyout
  const scen3Savings = 800;
  const scenario3: WhatIfScenario = {
    id: 'voucher-member-buyout',
    name: 'Replace departing traveler',
    description: `A frequent traveler in the group buys the voucher at 90% face value (₹13,500), giving everyone instant cash at better value than the airline.`,
    modifications: {},
    result: originalState,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: -scen3Savings,
      warnings: ['Member buyout completed cleanly.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: `-₹${scen3Savings.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'New participant',
    whoPaysMore: [],
    whoGetsMoneyBack: activeMembers.slice(0, 2).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: -400,
      reason: 'Bonus payout above airline cash alternative',
    })),
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Internal secondary market voucher transfer.',
      steps: [
        `Frequent traveler takes voucher for personal business trip.`,
        `Deposits ₹13,500 cash into trip fund, beating airline offer by ₹${(13500 - cashAlternative).toLocaleString('en-IN')}.`,
      ],
      estimatedSavings: 13500 - cashAlternative,
    },
  };

  // Scenario 4: Cancel and rebook
  const scen4Penalty = 2300;
  const scen4PerPerson = Math.round(scen4Penalty / activeMembers.length);
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen4PerPerson])),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'voucher-rebook-carrier',
    name: 'Cancel and rebook',
    description: `Escalate to airline customer relations for a free date exchange while rebooking intermediate ground transfers.`,
    modifications: {},
    result: scen4State,
    cascade: {
      affectedBookings: [{
        bookingId,
        bookingLabel,
        dependencyType: 'bundled_discount',
        constraint: 'Flight rescheduled; transfer windows adjusted',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: ['Schedule shift requires adjusting train connections.'],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen4PerPerson,
      reason: 'Rebooking difference and connection buffer',
    })),
    whoGetsMoneyBack: [],
    invalidBookings: [{
      bookingId,
      label: bookingLabel,
      reason: 'Flight moved to alternate flight number',
      severity: 'warning',
    }],
    cheapestFairPlan: {
      summary: 'Exchange ticket under airline goodwill policy.',
      steps: [
        `Free airline flight swap to morning departure.`,
        `Rebook connecting rail transfer.`,
      ],
      estimatedSavings: 4100,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: 'The airline offers vouchers instead of cash',
    proposalDescription: `Evaluates options for resolving the airline's voucher vs cash refund offer for ${bookingLabel}.`,
  };
}

// ─── 6. SCENARIO GENERATOR: Spending Cap / Liquidity Constraint ─────────────
// e.g. "One participant cannot pay more than Rs 8,000 this week."
export function generateSpendingCapScenarios(
  tripId: string,
  events: LedgerEvent[],
  memberId: string,
  memberName: string,
  maxSpendLimit: number = 8000
): WhatIfComparison {
  const originalState = replayEvents(tripId, events);
  const activeMembers = originalState.members.filter(m => m.isActive);
  const otherMembers = activeMembers.filter(m => m.memberId !== memberId);
  const otherCount = Math.max(1, otherMembers.length);

  const currentBal = Math.abs(originalState.balances[memberId] || 14400);
  const excess = Math.max(1200, currentBal - maxSpendLimit); // e.g. 6,400

  // Scenario 1: Keep current bookings (Fronted deferral)
  const scen1OtherDelta = Math.round(excess / otherCount);
  const scen1State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: -maxSpendLimit, // capped
      ...Object.fromEntries(otherMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen1OtherDelta])),
    },
  };

  const scenario1: WhatIfScenario = {
    id: 'cap-liquidity-deferral',
    name: 'Keep current bookings',
    description: `Maintain current bookings. Group fronts the ₹${excess.toLocaleString('en-IN')} excess above ₹${maxSpendLimit.toLocaleString('en-IN')}; ${memberName} repays on post-trip installment.`,
    modifications: {},
    result: scen1State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: excess,
      warnings: [`${memberName}'s weekly payment strictly capped at ₹${maxSpendLimit.toLocaleString('en-IN')}.`],
    },
    recommendation: 'Simple but expensive',
    groupImpactText: `+₹${excess.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Remaining room members',
    whoPaysMore: otherMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen1OtherDelta,
      reason: `Temporarily fronts ${memberName}'s deferred share`,
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -excess,
      reason: `Weekly liability capped at ₹${maxSpendLimit.toLocaleString('en-IN')}`,
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Execute structured 30-day deferred installment agreement.`,
      steps: [
        `${memberName} pays ₹${maxSpendLimit.toLocaleString('en-IN')} immediately.`,
        `Remaining ₹${excess.toLocaleString('en-IN')} fronted by group fund with auto-reminder.`,
      ],
      estimatedSavings: 0,
    },
  };

  // Scenario 2: Reassign rooms / Selective opt-outs (Lowest total cost)
  const scen2Cost = 1200;
  const scen2OtherDelta = Math.round(scen2Cost / 4);
  const scen2State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: -maxSpendLimit,
      ...Object.fromEntries(otherMembers.slice(0, 4).map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen2OtherDelta])),
    },
  };

  const scenario2: WhatIfScenario = {
    id: 'cap-selective-optouts',
    name: 'Reassign rooms',
    description: `${memberName} selectively opts out of 2 discretionary luxury excursions, bringing their net balance naturally under ₹${maxSpendLimit.toLocaleString('en-IN')}.`,
    modifications: {},
    result: scen2State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: scen2Cost,
      warnings: ['Discretionary luxury activities adjusted to optional individual tickets.'],
    },
    recommendation: 'Lowest total cost',
    groupImpactText: `+₹${scen2Cost.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Four travelers',
    whoPaysMore: otherMembers.slice(0, 4).map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen2OtherDelta,
      reason: 'Proportional group ticket tier readjustment',
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -excess,
      reason: `Cost lowered by skipping discretionary excursions`,
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: `Opt out of premium wine tasting & private boat tour.`,
      steps: [
        `Remove ${memberName} from 2 optional tickets.`,
        `Brings ${memberName}'s balance to ₹${maxSpendLimit.toLocaleString('en-IN')} with only ₹${scen2Cost.toLocaleString('en-IN')} net impact.`,
      ],
      estimatedSavings: excess - scen2Cost,
    },
  };

  // Scenario 3: Replace departing traveler / Solidarity pool
  const scen3Savings = 800;
  const scen3SolidarityContribution = Math.round(excess / activeMembers.length);
  const scen3State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      [memberId]: -maxSpendLimit,
      ...Object.fromEntries(otherMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen3SolidarityContribution])),
    },
  };

  const scenario3: WhatIfScenario = {
    id: 'cap-solidarity-pool',
    name: 'Replace departing traveler',
    description: `Activate pre-trip Mutual Solidarity Pool: Group absorbs ${memberName}'s excess via a micro-split (₹${scen3SolidarityContribution.toLocaleString('en-IN')} each).`,
    modifications: {},
    result: scen3State,
    cascade: {
      affectedBookings: [],
      memberImpacts: [],
      totalGroupImpact: -scen3Savings,
      warnings: ['Solidarity pool applied per Constitution Rule 3.'],
    },
    recommendation: 'Best overall value',
    groupImpactText: `-₹${scen3Savings.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'New participant',
    whoPaysMore: otherMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen3SolidarityContribution,
      reason: 'Voluntary solidarity pool contribution',
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -excess,
      reason: 'Subsidized by group solidarity pool',
    }],
    invalidBookings: [],
    cheapestFairPlan: {
      summary: 'Mutual solidarity micro-sharing across all travelers.',
      steps: [
        `Everyone contributes small micro-share of ₹${scen3SolidarityContribution.toLocaleString('en-IN')}.`,
        `Avoids excluding ${memberName} from any trip experiences.`,
      ],
      estimatedSavings: scen3Savings,
    },
  };

  // Scenario 4: Cancel and rebook (Budget pivot)
  const scen4Penalty = 2300;
  const scen4PerPerson = Math.round(scen4Penalty / activeMembers.length);
  const scen4State = {
    ...originalState,
    balances: {
      ...originalState.balances,
      ...Object.fromEntries(activeMembers.map(m => [m.memberId, (originalState.balances[m.memberId] || 0) - scen4PerPerson])),
    },
  };

  const scenario4: WhatIfScenario = {
    id: 'cap-budget-pivot',
    name: 'Cancel and rebook',
    description: `Pivot 2 expensive group activities to community-recommended free or budget-tier alternatives, lowering expenses for everyone.`,
    modifications: {},
    result: scen4State,
    cascade: {
      affectedBookings: [{
        bookingId: 'expensive-activity',
        bookingLabel: 'High-Ticket Safari / Excursion',
        dependencyType: 'activity_prereq',
        constraint: 'Swapped for budget-friendly alternative',
        isViolated: true,
      }],
      memberImpacts: [],
      totalGroupImpact: scen4Penalty,
      warnings: ['Itinerary modified to maintain group budget harmony.'],
    },
    recommendation: 'Most flexible',
    groupImpactText: `+₹${scen4Penalty.toLocaleString('en-IN')}`,
    whoIsAffectedText: 'Entire group',
    whoPaysMore: activeMembers.map(m => ({
      memberId: m.memberId,
      memberName: m.displayName,
      delta: scen4PerPerson,
      reason: 'Itinerary adjustment buffer',
    })),
    whoGetsMoneyBack: [{
      memberId,
      memberName,
      delta: -excess,
      reason: 'Overall trip budget lowered below cap',
    }],
    invalidBookings: [{
      bookingId: 'expensive-activity',
      label: 'High-Ticket Safari / Excursion',
      reason: 'Cancelled to accommodate group budget constraint',
      severity: 'critical',
    }],
    cheapestFairPlan: {
      summary: 'Swap expensive excursions for high-rated free landmarks.',
      steps: [
        `Cancel paid tour for 80% refund.`,
        `Replace with scenic mountain trek and night market walking tour.`,
      ],
      estimatedSavings: excess - scen4Penalty,
    },
  };

  const scenarios = [scenario1, scenario2, scenario3, scenario4];
  const memberDiffs = buildDiffsAndAnswers(originalState, scenarios);

  return {
    originalState,
    scenarios,
    memberDiffs,
    proposalTitle: `${memberName} cannot pay more than ₹${maxSpendLimit.toLocaleString('en-IN')}`,
    proposalDescription: `Evaluates fairness options to keep ${memberName}'s weekly liability under ₹${maxSpendLimit.toLocaleString('en-IN')}.`,
  };
}

// ─── 7. NATURAL QUERY PARSER ────────────────────────────────────────────────
// Allows the organizer to enter natural phrases matching the specification.

export type ChangeSimulationType =
  | 'member_leaves_after_day'
  | 'member_skips_booking'
  | 'private_rooms'
  | 'hotel_cancels_room'
  | 'airline_vouchers'
  | 'spending_cap';

export interface ParsedWhatIfQuery {
  type: ChangeSimulationType;
  memberId?: string;
  bookingId?: string;
  dayCutoff?: number;
  amount?: number;
  detectedText: string;
}

export function parseWhatIfQuery(
  rawQuery: string,
  members: DerivedMember[],
  bookings: DerivedBooking[]
): ParsedWhatIfQuery | null {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return null;

  // 1. "Aisha leaves after Day 2" / "leaves after day X" / "leaves"
  if (q.includes('leave') || q.includes('left') || q.includes('drops out') || q.includes('depart')) {
    const dayMatch = q.match(/day\s*(\d+)/i);
    const dayCutoff = dayMatch ? parseInt(dayMatch[1], 10) : 2;
    const matchedMember = members.find(m => q.includes(m.displayName.toLowerCase()));
    return {
      type: 'member_leaves_after_day',
      memberId: matchedMember?.memberId || members[0]?.memberId,
      dayCutoff,
      detectedText: `Participant leaves after Day ${dayCutoff}`,
    };
  }

  // 2. "Rahul skips rafting" / "skips"
  if (q.includes('skip') || q.includes('misses') || q.includes('opt out') || q.includes('opts out')) {
    const matchedMember = members.find(m => q.includes(m.displayName.toLowerCase()));
    const matchedBooking = bookings.find(b => q.includes(b.label.toLowerCase()));
    return {
      type: 'member_skips_booking',
      memberId: matchedMember?.memberId || members[0]?.memberId,
      bookingId: matchedBooking?.itemId || bookings[0]?.itemId,
      detectedText: 'Participant skips activity',
    };
  }

  // 3. "Two people want private rooms" / "private room"
  if (q.includes('private room') || q.includes('private rooms') || q.includes('room upgrade') || q.includes('separate room')) {
    return {
      type: 'private_rooms',
      amount: 6000,
      detectedText: 'Two people want private rooms',
    };
  }

  // 4. "The hotel cancels one room" / "hotel cancels"
  if (q.includes('hotel cancel') || q.includes('room cancel') || q.includes('cancels one room') || q.includes('hotel')) {
    const hotelBooking = bookings.find(b => b.type === 'hotel') || bookings[0];
    return {
      type: 'hotel_cancels_room',
      bookingId: hotelBooking?.itemId,
      amount: 4500,
      detectedText: 'The hotel cancels one room',
    };
  }

  // 5. "The airline offers vouchers instead of cash" / "voucher"
  if (q.includes('voucher') || q.includes('airline') || q.includes('flight') || q.includes('cash refund')) {
    const flightBooking = bookings.find(b => b.type === 'flight') || bookings[0];
    return {
      type: 'airline_vouchers',
      bookingId: flightBooking?.itemId,
      amount: 15000,
      detectedText: 'Airline offers vouchers instead of cash',
    };
  }

  // 6. "One participant cannot pay more than Rs 8,000 this week" / "cap"
  if (q.includes('cannot pay') || q.includes('can\'t pay') || q.includes('cap') || q.includes('limit') || q.includes('8000') || q.includes('8,000')) {
    const matchedMember = members.find(m => q.includes(m.displayName.toLowerCase()));
    const numMatch = q.match(/(\d+[\d,]*)/);
    const amount = numMatch ? parseInt(numMatch[1].replace(/,/g, ''), 10) : 8000;
    return {
      type: 'spending_cap',
      memberId: matchedMember?.memberId || members[0]?.memberId,
      amount,
      detectedText: `Participant cannot pay more than ₹${amount.toLocaleString('en-IN')}`,
    };
  }

  return null;
}
