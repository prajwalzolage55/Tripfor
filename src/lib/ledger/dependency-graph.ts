// ─── Dependency Graph: Financial Event Graph ────────────────────────────────
// Models cascading effects when bookings change.
// When one booking changes, the graph lights up to show every downstream
// impact on cost, assignment, and fairness.

import type { DerivedBooking, DerivedMember, DerivedExpense } from './replay-engine';

// ─── Graph Node Types ───────────────────────────────────────────────────────

export type NodeType = 'person' | 'booking' | 'expense' | 'refund' | 'dependency';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: any;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  relationship: 'participates_in' | 'paid_for' | 'depends_on' | 'refunds' | 'split_with';
  weight?: number;   // e.g., cost share amount
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Impact Analysis Types ──────────────────────────────────────────────────

export interface CascadeImpact {
  memberId: string;
  memberName: string;
  previousShare: number;
  newShare: number;
  delta: number;           // positive = pays more, negative = pays less
}

export interface BookingDependency {
  bookingId: string;
  bookingLabel: string;
  dependencyType: 'room_capacity' | 'min_group_size' | 'bundled_discount' | 'activity_prereq';
  constraint: string;      // human-readable constraint description
  isViolated: boolean;     // true if the proposed change breaks this dependency
}

export interface CascadeResult {
  affectedBookings: BookingDependency[];
  memberImpacts: CascadeImpact[];
  totalGroupImpact: number;
  warnings: string[];
}

// ─── Build Dependency Graph ─────────────────────────────────────────────────

/**
 * Builds a financial dependency graph from the current trip state.
 * This graph is used to visualize cascading effects when things change.
 */
export function buildDependencyGraph(
  members: DerivedMember[],
  bookings: DerivedBooking[],
  expenses: DerivedExpense[]
): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add person nodes
  for (const member of members) {
    if (!member.isActive) continue;
    nodes.push({
      id: member.memberId,
      type: 'person',
      label: member.displayName,
      data: member,
    });
  }

  // Add booking nodes
  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    nodes.push({
      id: booking.itemId,
      type: 'booking',
      label: booking.label,
      data: booking,
    });

    // Add edges: person → booking (participation)
    for (const memberId of booking.participantMemberIds) {
      edges.push({
        fromId: memberId,
        toId: booking.itemId,
        relationship: 'participates_in',
        weight: booking.cost / booking.participantMemberIds.length,
      });
    }
  }

  // Add expense nodes and edges
  for (const expense of expenses) {
    if (expense.isDeleted) continue;
    nodes.push({
      id: expense.expenseId,
      type: 'expense',
      label: expense.note || `Expense ₹${expense.amount}`,
      data: expense,
    });

    // Payer → expense
    edges.push({
      fromId: expense.paidByMemberId,
      toId: expense.expenseId,
      relationship: 'paid_for',
      weight: expense.amount,
    });

    // Expense → booking (if linked)
    if (expense.itemId) {
      edges.push({
        fromId: expense.expenseId,
        toId: expense.itemId,
        relationship: 'depends_on',
      });
    }
  }

  return { nodes, edges };
}

// ─── Cascade Analysis ───────────────────────────────────────────────────────

/**
 * Analyzes the cascading impact of removing a participant from the trip
 * or from specific bookings.
 */
export function analyzeCascade(
  memberIdToRemove: string,
  bookings: DerivedBooking[],
  allMemberIds: string[]
): CascadeResult {
  const affectedBookings: BookingDependency[] = [];
  const memberImpacts: CascadeImpact[] = [];
  const warnings: string[] = [];
  let totalGroupImpact = 0;

  // Check each booking the removed member participates in
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

    // Calculate cost shift
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

      // Impact on each remaining member
      for (const memberId of booking.participantMemberIds) {
        if (memberId === memberIdToRemove) continue;

        const existing = memberImpacts.find(m => m.memberId === memberId);
        if (existing) {
          existing.newShare += costIncrease;
          existing.delta += costIncrease;
        } else {
          memberImpacts.push({
            memberId,
            memberName: '',  // filled in by caller
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

/**
 * Gets all bookings that depend on a specific booking (e.g., transfer depends on hotel).
 */
export function getDownstreamDependencies(
  bookingId: string,
  bookings: DerivedBooking[]
): DerivedBooking[] {
  // For now, simple: bookings with overlapping participants and time proximity
  const sourceBooking = bookings.find(b => b.itemId === bookingId);
  if (!sourceBooking) return [];

  return bookings.filter(b => {
    if (b.itemId === bookingId || b.status === 'cancelled') return false;
    // Check participant overlap
    const overlap = b.participantMemberIds.some(id =>
      sourceBooking.participantMemberIds.includes(id)
    );
    return overlap;
  });
}
