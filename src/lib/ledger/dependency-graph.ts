// ─── Financial Event Graph: Dependency Graph Across 6 Node Types ────────────
// Section 4 · Solution Design
//
// Behind the interface, the trip is a dependency graph across six node types:
//   People        — Travelers, organizers, guests
//   Commitments   — Bookings, deposits, cancellation obligations
//   Consumption   — Who actually used each service
//   Payments      — Who paid and from which source
//   Benefits      — Refunds, vouchers, rewards, insurance claims
//   Dependencies  — Room capacity, minimum group size, bundled discounts
//
// This structure models cascading effects — when one booking changes, the graph
// lights up to show every downstream impact on cost, assignment, and fairness.

import type { DerivedBooking, DerivedMember, DerivedExpense, TripState } from './replay-engine';
import { DEFAULT_CONSTITUTION, type FairnessRule, generateRuleCitation } from './fairness-rules';

// ─── 6 Canonical Financial Node Types ───────────────────────────────────────

export type FinancialNodeType =
  | 'people'
  | 'commitments'
  | 'consumption'
  | 'payments'
  | 'benefits'
  | 'dependencies';

export type LegacyNodeType = 'person' | 'booking' | 'expense' | 'refund' | 'dependency';
export type NodeType = LegacyNodeType | FinancialNodeType;

export interface FinancialNode {
  id: string;
  type: FinancialNodeType;
  label: string;
  sublabel?: string;
  amount?: number;
  currency?: string;
  status: 'active' | 'affected' | 'violated' | 'fulfilled' | 'cancelled' | 'pending';
  glowColor?: string;
  isLit?: boolean;           // True when the graph lights up during cascade
  metadata?: Record<string, any>;
}

// Backwards compatibility for existing code
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: any;
}

export type FinancialEdgeRelation =
  | 'commits_to'       // Person -> Commitment
  | 'consumes'         // Person -> Consumption
  | 'allocated_to'     // Consumption -> Commitment
  | 'funds'            // Person -> Payment
  | 'settles'          // Payment -> Commitment
  | 'entitled_to'      // Benefit -> Person
  | 'constrains'       // Dependency -> Commitment
  | 'derives_from';    // Benefit -> Commitment

export interface FinancialEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: FinancialEdgeRelation | string;
  label?: string;
  weight?: number;
  isLit?: boolean;
}

// Backwards compatibility
export interface GraphEdge {
  fromId: string;
  toId: string;
  relationship: 'participates_in' | 'paid_for' | 'depends_on' | 'refunds' | 'split_with' | string;
  weight?: number;
}

export interface FinancialGraph {
  nodes: FinancialNode[];
  edges: FinancialEdge[];
  summary: {
    peopleCount: number;
    commitmentsCount: number;
    consumptionCount: number;
    paymentsCount: number;
    benefitsCount: number;
    dependenciesCount: number;
    totalCommittedCost: number;
  };
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Cascading Analysis Types ───────────────────────────────────────────────

export interface CascadeImpact {
  memberId: string;
  memberName: string;
  previousShare: number;
  newShare: number;
  delta: number;           // positive = pays more, negative = pays less
  reason?: string;
}

export interface BookingDependency {
  bookingId: string;
  bookingLabel: string;
  dependencyType: 'room_capacity' | 'min_group_size' | 'bundled_discount' | 'activity_prereq' | 'cancellation_obligation';
  constraint: string;      // human-readable constraint description
  isViolated: boolean;     // true if the proposed change breaks this dependency
  currentValue?: number | string;
  thresholdValue?: number | string;
}

export interface CascadeResult {
  affectedBookings: BookingDependency[];
  memberImpacts: CascadeImpact[];
  totalGroupImpact: number;
  warnings: string[];
  litNodeIds?: string[];
  litEdgeIds?: string[];
  applicableRuleCitations?: string[];
}

export interface CascadeChangeRequest {
  type: 'cancel_booking' | 'member_withdraws' | 'price_increase' | 'capacity_overrun';
  targetBookingId?: string;
  targetMemberId?: string;
  deltaPrice?: number;
}

// ─── Build the 6-Node Financial Event Graph ─────────────────────────────────

/**
 * Builds the comprehensive Financial Event Graph across the 6 node types
 * specified in Section 4 using real trip data.
 */
export function buildFinancialEventGraph(
  state: TripState,
  constitution?: FairnessRule[]
): FinancialGraph {
  const nodes: FinancialNode[] = [];
  const edges: FinancialEdge[] = [];
  const activeConstitution = constitution || state.constitution || DEFAULT_CONSTITUTION;

  let totalCommittedCost = 0;

  // 1. PEOPLE NODES (Travelers, Organizers, Guests)
  const organizerId = state.members[0]?.memberId;

  for (const member of state.members) {
    const isOrganizer = member.memberId === organizerId;
    const balance = state.balances[member.memberId] ?? 0;
    const roleLabel = isOrganizer ? 'Organizer' : 'Traveler';

    nodes.push({
      id: `person_${member.memberId}`,
      type: 'people',
      label: member.displayName,
      sublabel: `${roleLabel} · ${balance >= 0 ? '+' : ''}₹${Math.round(balance).toLocaleString('en-IN')}`,
      amount: balance,
      status: member.isActive ? 'active' : 'cancelled',
      glowColor: '#6366f1', // Indigo
      metadata: {
        memberId: member.memberId,
        userId: member.userId,
        joinedAt: member.joinedAt,
        isOrganizer,
      },
    });
  }

  // 2. COMMITMENTS NODES (Bookings, Deposits, Obligations)
  for (const booking of state.bookings) {
    if (booking.status === 'cancelled') continue;
    totalCommittedCost += booking.cost;

    nodes.push({
      id: `commitment_${booking.itemId}`,
      type: 'commitments',
      label: booking.label,
      sublabel: `${booking.type.toUpperCase()} · ₹${booking.cost.toLocaleString('en-IN')}`,
      amount: booking.cost,
      status: 'active',
      glowColor: '#10b981', // Emerald
      metadata: {
        bookingId: booking.itemId,
        type: booking.type,
        vendor: booking.vendorName,
        cancellationPolicy: booking.cancellationPolicy,
        participantCount: booking.participantMemberIds.length,
      },
    });

    // Edge: People -> Commitment (Who committed)
    for (const memberId of booking.participantMemberIds) {
      edges.push({
        id: `edge_commits_${memberId}_${booking.itemId}`,
        fromId: `person_${memberId}`,
        toId: `commitment_${booking.itemId}`,
        relation: 'commits_to',
        label: 'Signed up',
      });
    }

    // 3. CONSUMPTION NODES (Who actually uses each service)
    const occupantCount = Math.max(1, booking.participantMemberIds.length);
    const perPersonCost = Math.round((booking.cost / occupantCount) * 100) / 100;

    for (const memberId of booking.participantMemberIds) {
      const member = state.members.find(m => m.memberId === memberId);
      const memberName = member ? member.displayName : 'Member';
      const consumptionId = `consumption_${booking.itemId}_${memberId}`;

      nodes.push({
        id: consumptionId,
        type: 'consumption',
        label: `${memberName}'s Share`,
        sublabel: `₹${perPersonCost.toLocaleString('en-IN')} of ${booking.label}`,
        amount: perPersonCost,
        status: 'active',
        glowColor: '#f59e0b', // Amber
        metadata: {
          memberId,
          bookingId: booking.itemId,
          shareAmount: perPersonCost,
        },
      });

      // Edge: Person -> Consumption
      edges.push({
        id: `edge_consumes_${memberId}_${consumptionId}`,
        fromId: `person_${memberId}`,
        toId: consumptionId,
        relation: 'consumes',
        weight: perPersonCost,
      });

      // Edge: Consumption -> Commitment
      edges.push({
        id: `edge_allocates_${consumptionId}_${booking.itemId}`,
        fromId: consumptionId,
        toId: `commitment_${booking.itemId}`,
        relation: 'allocated_to',
        weight: perPersonCost,
      });
    }

    // 6. DEPENDENCIES NODES (Room capacity, Minimum group size, Bundled discounts)
    // Model real capacity constraints based on booking type
    if (booking.type === 'hotel' || booking.type === 'accommodation') {
      const depId = `dep_capacity_${booking.itemId}`;
      const maxCapacity = 4; // Standard room max capacity
      const isOverCapacity = booking.participantMemberIds.length > maxCapacity;
      const isUnderCapacity = booking.participantMemberIds.length < 2 && booking.cost > 5000;

      nodes.push({
        id: depId,
        type: 'dependencies',
        label: `${booking.label} Capacity`,
        sublabel: `${booking.participantMemberIds.length}/${maxCapacity} Occupants`,
        status: isOverCapacity ? 'violated' : 'active',
        glowColor: isOverCapacity ? '#f43f5e' : '#ec4899', // Rose/Pink
        metadata: {
          dependencyType: 'room_capacity',
          bookingId: booking.itemId,
          maxCapacity,
          currentOccupancy: booking.participantMemberIds.length,
        },
      });

      edges.push({
        id: `edge_dep_capacity_${depId}_${booking.itemId}`,
        fromId: depId,
        toId: `commitment_${booking.itemId}`,
        relation: 'constrains',
        label: 'Room limit',
      });
    }

    if (booking.type === 'activity' || booking.type === 'transfer') {
      const depId = `dep_minsize_${booking.itemId}`;
      const minGroup = 3;
      const isViolated = booking.participantMemberIds.length < minGroup;

      nodes.push({
        id: depId,
        type: 'dependencies',
        label: `${booking.label} Min Group`,
        sublabel: `Min ${minGroup} travelers (${booking.participantMemberIds.length} signed up)`,
        status: isViolated ? 'violated' : 'active',
        glowColor: isViolated ? '#f43f5e' : '#ec4899',
        metadata: {
          dependencyType: 'min_group_size',
          bookingId: booking.itemId,
          minGroup,
          currentParticipants: booking.participantMemberIds.length,
        },
      });

      edges.push({
        id: `edge_dep_minsize_${depId}_${booking.itemId}`,
        fromId: depId,
        toId: `commitment_${booking.itemId}`,
        relation: 'constrains',
        label: 'Min threshold',
      });
    }
  }

  // 4. PAYMENTS NODES (Who paid & from which source)
  for (const expense of state.expenses) {
    if (expense.isDeleted) continue;
    const payer = state.members.find(m => m.memberId === expense.paidByMemberId);
    const payerName = payer ? payer.displayName : 'Organizer';
    const payNodeId = `payment_${expense.expenseId}`;

    nodes.push({
      id: payNodeId,
      type: 'payments',
      label: `Paid ₹${expense.amount.toLocaleString('en-IN')}`,
      sublabel: `${payerName} · ${expense.note || 'Expense'}`,
      amount: expense.amount,
      status: 'fulfilled',
      glowColor: '#8b5cf6', // Violet
      metadata: {
        expenseId: expense.expenseId,
        paidBy: expense.paidByMemberId,
        splitType: expense.splitType,
      },
    });

    // Edge: Person -> Payment
    edges.push({
      id: `edge_pays_${expense.paidByMemberId}_${payNodeId}`,
      fromId: `person_${expense.paidByMemberId}`,
      toId: payNodeId,
      relation: 'funds',
      weight: expense.amount,
    });

    // If expense links to a booking
    if (expense.itemId) {
      edges.push({
        id: `edge_settles_${payNodeId}_${expense.itemId}`,
        fromId: payNodeId,
        toId: `commitment_${expense.itemId}`,
        relation: 'settles',
        weight: expense.amount,
      });
    }
  }

  // 5. BENEFITS NODES (Refunds, vouchers, vendor credits)
  for (const refund of state.refunds) {
    const benefitId = `benefit_${refund.refundId}`;
    const receiver = state.members.find(m => m.memberId === refund.receivedByMemberId);

    nodes.push({
      id: benefitId,
      type: 'benefits',
      label: `Vendor Refund ₹${refund.amount.toLocaleString('en-IN')}`,
      sublabel: `${refund.vendorName || 'Vendor'} → ${receiver?.displayName || 'Cardholder'}`,
      amount: refund.amount,
      status: refund.isRedistributed ? 'fulfilled' : 'pending',
      glowColor: '#06b6d4', // Cyan
      metadata: {
        refundId: refund.refundId,
        linkedItemId: refund.linkedItemId,
        isRedistributed: refund.isRedistributed,
      },
    });

    if (refund.linkedItemId) {
      edges.push({
        id: `edge_derives_${benefitId}_${refund.linkedItemId}`,
        fromId: benefitId,
        toId: `commitment_${refund.linkedItemId}`,
        relation: 'derives_from',
        weight: refund.amount,
      });
    }

    // Under Rule 7, credit flows to original funders
    if (refund.distributions) {
      for (const dist of refund.distributions) {
        edges.push({
          id: `edge_benefits_${benefitId}_${dist.memberId}`,
          fromId: benefitId,
          toId: `person_${dist.memberId}`,
          relation: 'entitled_to',
          label: 'Rule 7 funder credit',
          weight: dist.amount,
        });
      }
    }
  }

  // Summary counts
  const summary = {
    peopleCount: nodes.filter(n => n.type === 'people').length,
    commitmentsCount: nodes.filter(n => n.type === 'commitments').length,
    consumptionCount: nodes.filter(n => n.type === 'consumption').length,
    paymentsCount: nodes.filter(n => n.type === 'payments').length,
    benefitsCount: nodes.filter(n => n.type === 'benefits').length,
    dependenciesCount: nodes.filter(n => n.type === 'dependencies').length,
    totalCommittedCost,
  };

  return { nodes, edges, summary };
}

// ─── Cascading Effects Simulator ("Graph Lights Up") ────────────────────────

/**
 * Simulates cascading effects when one booking changes.
 * The graph lights up to show every downstream impact on cost, assignment, and fairness.
 */
export function simulateGraphCascade(
  graph: FinancialGraph,
  state: TripState,
  change: CascadeChangeRequest,
  constitution?: FairnessRule[]
): CascadeResult {
  const activeConstitution = constitution || state.constitution || DEFAULT_CONSTITUTION;
  const litNodeIds = new Set<string>();
  const litEdgeIds = new Set<string>();
  const affectedBookings: BookingDependency[] = [];
  const memberImpacts: CascadeImpact[] = [];
  const warnings: string[] = [];
  const applicableRuleCitations: string[] = [];
  let totalGroupImpact = 0;

  // ── Scenario A: Cancel Entire Booking ──
  if (change.type === 'cancel_booking' && change.targetBookingId) {
    const targetBooking = state.bookings.find(b => b.itemId === change.targetBookingId);
    if (targetBooking) {
      const commitmentNodeId = `commitment_${targetBooking.itemId}`;
      litNodeIds.add(commitmentNodeId);

      // Light up all connected consumption nodes
      for (const memberId of targetBooking.participantMemberIds) {
        const consumptionNodeId = `consumption_${targetBooking.itemId}_${memberId}`;
        const personNodeId = `person_${memberId}`;
        litNodeIds.add(consumptionNodeId);
        litNodeIds.add(personNodeId);

        // Lit edges
        litEdgeIds.add(`edge_commits_${memberId}_${targetBooking.itemId}`);
        litEdgeIds.add(`edge_consumes_${memberId}_${consumptionNodeId}`);
        litEdgeIds.add(`edge_allocates_${consumptionNodeId}_${targetBooking.itemId}`);

        const member = state.members.find(m => m.memberId === memberId);
        const originalShare = targetBooking.cost / Math.max(1, targetBooking.participantMemberIds.length);

        memberImpacts.push({
          memberId,
          memberName: member?.displayName || 'Traveler',
          previousShare: originalShare,
          newShare: 0,
          delta: -originalShare, // save money from cancellation
          reason: `Booking cancelled; relieved of share ₹${Math.round(originalShare).toLocaleString('en-IN')}`,
        });
        totalGroupImpact -= originalShare;
      }

      // Check dependent constraints
      const depNodes = graph.nodes.filter(
        n => n.type === 'dependencies' && n.metadata?.bookingId === targetBooking.itemId
      );
      for (const d of depNodes) {
        litNodeIds.add(d.id);
        litEdgeIds.add(`edge_dep_${d.metadata?.dependencyType === 'room_capacity' ? 'capacity' : 'minsize'}_${d.id}_${targetBooking.itemId}`);
        affectedBookings.push({
          bookingId: targetBooking.itemId,
          bookingLabel: targetBooking.label,
          dependencyType: d.metadata?.dependencyType || 'cancellation_obligation',
          constraint: `Booking cancelled. Downstream dependency ${d.label} is deactivated.`,
          isViolated: false,
        });
      }

      // Cite Rule 3 (Group-Forced Cancellation Solidarity) or Rule 7
      const rule3 = activeConstitution.find(r => r.id === 'group_cancel_shared_equally') || DEFAULT_CONSTITUTION[2];
      const rule7 = activeConstitution.find(r => r.id === 'refund_to_funder') || DEFAULT_CONSTITUTION[6];

      applicableRuleCitations.push(
        `Under Rule ${rule3.ruleNumber} (${rule3.name}), any non-refundable vendor fee for ${targetBooking.label} is shared equally across all affected travelers.`
      );
      applicableRuleCitations.push(
        `Under Rule ${rule7.ruleNumber} (${rule7.name}), vendor refunds return directly to the economic funders, not merely to the cardholder.`
      );

      warnings.push(`Cancelling "${targetBooking.label}" frees ₹${targetBooking.cost.toLocaleString('en-IN')} across ${targetBooking.participantMemberIds.length} participants.`);
    }
  }

  // ── Scenario B: Participant Leaves / Drops Out of Booking ──
  if (change.type === 'member_withdraws' && change.targetMemberId && change.targetBookingId) {
    const booking = state.bookings.find(b => b.itemId === change.targetBookingId);
    const member = state.members.find(m => m.memberId === change.targetMemberId);

    if (booking && member) {
      const commitmentNodeId = `commitment_${booking.itemId}`;
      const withdrawingPersonNodeId = `person_${member.memberId}`;
      const withdrawingConsumptionId = `consumption_${booking.itemId}_${member.memberId}`;

      litNodeIds.add(commitmentNodeId);
      litNodeIds.add(withdrawingPersonNodeId);
      litNodeIds.add(withdrawingConsumptionId);

      const currentCount = Math.max(1, booking.participantMemberIds.length);
      const newCount = Math.max(1, currentCount - 1);
      const originalShare = booking.cost / currentCount;
      const newShare = booking.cost / newCount;
      const shortfallDelta = newShare - originalShare;

      // Check room capacity / min group size dependency
      const depNodes = graph.nodes.filter(
        n => n.type === 'dependencies' && n.metadata?.bookingId === booking.itemId
      );
      for (const d of depNodes) {
        litNodeIds.add(d.id);
        const isViolated = d.metadata?.dependencyType === 'min_group_size' && newCount < (d.metadata?.minGroup || 3);
        affectedBookings.push({
          bookingId: booking.itemId,
          bookingLabel: booking.label,
          dependencyType: d.metadata?.dependencyType || 'room_capacity',
          constraint: isViolated
            ? `Minimum group size of ${d.metadata?.minGroup} broken (${newCount} remaining)`
            : `Room occupancy dropped from ${currentCount} to ${newCount}`,
          isViolated,
          currentValue: newCount,
          thresholdValue: d.metadata?.minGroup || 4,
        });

        if (isViolated) {
          warnings.push(`ALERT: "${booking.label}" requires minimum ${d.metadata?.minGroup} people. Withdrawing drops count to ${newCount}!`);
        }
      }

      // Light up remaining participants' consumption nodes
      for (const otherMemberId of booking.participantMemberIds) {
        if (otherMemberId === member.memberId) continue;
        const otherPersonId = `person_${otherMemberId}`;
        const otherConsumptionId = `consumption_${booking.itemId}_${otherMemberId}`;
        litNodeIds.add(otherPersonId);
        litNodeIds.add(otherConsumptionId);

        const otherMem = state.members.find(m => m.memberId === otherMemberId);
        memberImpacts.push({
          memberId: otherMemberId,
          memberName: otherMem?.displayName || 'Roommate',
          previousShare: originalShare,
          newShare,
          delta: shortfallDelta,
          reason: `Cost increased by ₹${Math.round(shortfallDelta).toLocaleString('en-IN')} because ${booking.label} changed from ${currentCount} occupants to ${newCount}.`,
        });
        totalGroupImpact += shortfallDelta;
      }

      // Governing Rule Citation (Rule 2: Voluntary Cancellation Responsibility)
      const rule2 = activeConstitution.find(r => r.id === 'voluntary_cancel_pays_loss') || DEFAULT_CONSTITUTION[1];
      applicableRuleCitations.push(
        `"${member.displayName}'s balance increased by ₹${Math.round(shortfallDelta * (currentCount - 1)).toLocaleString('en-IN')} because ${booking.label} changed from ${currentCount} occupants to ${newCount}. Under Rule ${rule2.ruleNumber} (${rule2.name}), voluntary withdrawal costs remain assigned to the withdrawing participant until a replacement joins."`
      );
    }
  }

  // ── Scenario C: Price or Tariff Shift ──
  if (change.type === 'price_increase' && change.targetBookingId && change.deltaPrice) {
    const booking = state.bookings.find(b => b.itemId === change.targetBookingId);
    if (booking) {
      litNodeIds.add(`commitment_${booking.itemId}`);
      const perPersonDelta = change.deltaPrice / Math.max(1, booking.participantMemberIds.length);

      for (const mId of booking.participantMemberIds) {
        litNodeIds.add(`consumption_${booking.itemId}_${mId}`);
        litNodeIds.add(`person_${mId}`);

        const m = state.members.find(mem => mem.memberId === mId);
        memberImpacts.push({
          memberId: mId,
          memberName: m?.displayName || 'Traveler',
          previousShare: booking.cost / booking.participantMemberIds.length,
          newShare: (booking.cost + change.deltaPrice) / booking.participantMemberIds.length,
          delta: perPersonDelta,
          reason: `Vendor increased rate for ${booking.label} by ₹${change.deltaPrice.toLocaleString('en-IN')}`,
        });
      }
      totalGroupImpact = change.deltaPrice;
    }
  }

  return {
    affectedBookings,
    memberImpacts,
    totalGroupImpact: Math.round(totalGroupImpact * 100) / 100,
    warnings,
    litNodeIds: Array.from(litNodeIds),
    litEdgeIds: Array.from(litEdgeIds),
    applicableRuleCitations,
  };
}

// ─── Legacy Compatibility Wrappers ──────────────────────────────────────────

export function buildDependencyGraph(
  members: DerivedMember[],
  bookings: DerivedBooking[],
  expenses: DerivedExpense[]
): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const member of members) {
    if (!member.isActive) continue;
    nodes.push({ id: member.memberId, type: 'person', label: member.displayName, data: member });
  }

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    nodes.push({ id: booking.itemId, type: 'booking', label: booking.label, data: booking });
    for (const memberId of booking.participantMemberIds) {
      edges.push({
        fromId: memberId,
        toId: booking.itemId,
        relationship: 'participates_in',
        weight: booking.cost / Math.max(1, booking.participantMemberIds.length),
      });
    }
  }

  for (const expense of expenses) {
    if (expense.isDeleted) continue;
    nodes.push({ id: expense.expenseId, type: 'expense', label: expense.note || `Expense ₹${expense.amount}`, data: expense });
    edges.push({ fromId: expense.paidByMemberId, toId: expense.expenseId, relationship: 'paid_for', weight: expense.amount });
    if (expense.itemId) {
      edges.push({ fromId: expense.expenseId, toId: expense.itemId, relationship: 'depends_on' });
    }
  }

  return { nodes, edges };
}

export function analyzeCascade(
  memberIdToRemove: string,
  bookings: DerivedBooking[],
  allMemberIds: string[]
): CascadeResult {
  const affectedBookings: BookingDependency[] = [];
  const memberImpacts: CascadeImpact[] = [];
  const warnings: string[] = [];
  let totalGroupImpact = 0;

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    if (!booking.participantMemberIds.includes(memberIdToRemove)) continue;

    const currentParticipants = booking.participantMemberIds.length;
    const newParticipants = currentParticipants - 1;

    if (newParticipants === 0) {
      affectedBookings.push({
        bookingId: booking.itemId,
        bookingLabel: booking.label,
        dependencyType: 'min_group_size',
        constraint: 'Booking has no remaining participants',
        isViolated: true,
      });
      warnings.push(`"${booking.label}" would have no participants — must be cancelled or reassigned.`);
      continue;
    }

    const previousPerPerson = booking.cost / currentParticipants;
    const newPerPerson = booking.cost / newParticipants;
    const costIncrease = newPerPerson - previousPerPerson;

    if (costIncrease > 0) {
      affectedBookings.push({
        bookingId: booking.itemId,
        bookingLabel: booking.label,
        dependencyType: 'room_capacity',
        constraint: `Per-person cost increases from ₹${Math.round(previousPerPerson)} to ₹${Math.round(newPerPerson)}`,
        isViolated: false,
      });

      for (const memberId of booking.participantMemberIds) {
        if (memberId === memberIdToRemove) continue;

        const existing = memberImpacts.find(m => m.memberId === memberId);
        if (existing) {
          existing.newShare += costIncrease;
          existing.delta += costIncrease;
        } else {
          memberImpacts.push({
            memberId,
            memberName: '',
            previousShare: previousPerPerson,
            newShare: newPerPerson,
            delta: costIncrease,
          });
        }
        totalGroupImpact += costIncrease;
      }
    }
  }

  return {
    affectedBookings,
    memberImpacts,
    totalGroupImpact: Math.round(totalGroupImpact * 100) / 100,
    warnings,
  };
}

export function getDownstreamDependencies(
  bookingId: string,
  bookings: DerivedBooking[]
): DerivedBooking[] {
  const sourceBooking = bookings.find(b => b.itemId === bookingId);
  if (!sourceBooking) return [];

  return bookings.filter(b => {
    if (b.itemId === bookingId || b.status === 'cancelled') return false;
    return b.participantMemberIds.some(id => sourceBooking.participantMemberIds.includes(id));
  });
}
