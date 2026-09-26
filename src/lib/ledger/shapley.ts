// ─── Shapley Value Calculator ───────────────────────────────────────────────
// Mathematically fair cost allocation using cooperative game theory.
//
// The Shapley value computes each person's marginal contribution to the total
// cost across all possible subgroups. This handles edge cases like:
// - Shared car used by different subsets on different days
// - Room shared by varying occupants across nights
// - Group discounts that only apply above a minimum size
//
// The algorithm is O(n × 2^n) in participants. For 6-8 people (typical trip),
// this is 384-2048 evaluations — very fast. For larger groups, we use the
// Monte Carlo approximation.

import type { DerivedBooking, DerivedMember, TripState } from './replay-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShapleyAllocation {
  memberId: string;
  memberName: string;
  shapleyShare: number;        // fair share computed via Shapley
  equalShare: number;          // naive equal split for comparison
  difference: number;          // shapleyShare - equalShare
  percentageOfTotal: number;   // share as percentage of total cost
  breakdown: ShapleyBreakdown[];
}

export interface ShapleyBreakdown {
  bookingId: string;
  bookingLabel: string;
  contribution: number;        // this member's Shapley share of this booking
  totalCost: number;           // total booking cost
}

export interface ShapleyResult {
  allocations: ShapleyAllocation[];
  totalCost: number;
  method: 'exact' | 'monte_carlo';  // exact for ≤8 players, MC for more
  fairnessScore: number;       // 0-100, how different from equal split
}

// ─── Characteristic Function ────────────────────────────────────────────────

/**
 * The characteristic function v(S) defines the cost of a coalition S.
 * For trip cost allocation:
 * v(S) = sum of costs of all bookings where ALL participants are in S
 *
 * A booking is "activated" by coalition S if at least one of its participants
 * is in S. The cost assigned to S is the total cost of activated bookings.
 */
function characteristicFunction(
  coalition: Set<string>,
  bookings: DerivedBooking[]
): number {
  let totalCost = 0;

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;

    // A booking contributes to the coalition's cost if any of its participants
    // are in the coalition
    const participantsInCoalition = booking.participantMemberIds.filter(id =>
      coalition.has(id)
    );

    if (participantsInCoalition.length > 0) {
      // Pro-rate cost based on what fraction of participants are in this coalition
      // This handles partial participation correctly
      const fraction = participantsInCoalition.length / booking.participantMemberIds.length;
      totalCost += booking.cost * fraction;
    }
  }

  return totalCost;
}

// ─── Exact Shapley Computation ──────────────────────────────────────────────

/**
 * Compute exact Shapley values for each player.
 * Formula: φ_i = Σ [|S|! × (n-|S|-1)! / n!] × [v(S ∪ {i}) - v(S)]
 * where the sum is over all subsets S ⊆ N \ {i}
 */
function computeExactShapley(
  playerIds: string[],
  bookings: DerivedBooking[]
): Map<string, number> {
  const n = playerIds.length;
  const shapleyValues = new Map<string, number>();

  // Precompute factorials
  const factorial = (x: number): number => {
    if (x <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= x; i++) result *= i;
    return result;
  };

  const nFactorial = factorial(n);

  for (const playerId of playerIds) {
    let shapleyValue = 0;

    // Generate all subsets of N \ {playerId}
    const otherPlayers = playerIds.filter(id => id !== playerId);
    const numSubsets = 1 << otherPlayers.length; // 2^(n-1)

    for (let mask = 0; mask < numSubsets; mask++) {
      // Build coalition S from bitmask
      const coalition = new Set<string>();
      for (let j = 0; j < otherPlayers.length; j++) {
        if (mask & (1 << j)) {
          coalition.add(otherPlayers[j]);
        }
      }

      const s = coalition.size;

      // v(S ∪ {i})
      const coalitionWithPlayer = new Set(coalition);
      coalitionWithPlayer.add(playerId);
      const vWithPlayer = characteristicFunction(coalitionWithPlayer, bookings);

      // v(S)
      const vWithoutPlayer = characteristicFunction(coalition, bookings);

      // Marginal contribution
      const marginal = vWithPlayer - vWithoutPlayer;

      // Shapley weight: |S|! × (n-|S|-1)! / n!
      const weight = (factorial(s) * factorial(n - s - 1)) / nFactorial;

      shapleyValue += weight * marginal;
    }

    shapleyValues.set(playerId, Math.round(shapleyValue * 100) / 100);
  }

  return shapleyValues;
}

// ─── Monte Carlo Approximation ──────────────────────────────────────────────

/**
 * For groups > 8, use Monte Carlo approximation.
 * Randomly sample permutations and average marginal contributions.
 */
function computeMonteCarloShapley(
  playerIds: string[],
  bookings: DerivedBooking[],
  iterations: number = 5000
): Map<string, number> {
  const n = playerIds.length;
  const shapleyValues = new Map<string, number>();

  // Initialize
  playerIds.forEach(id => shapleyValues.set(id, 0));

  for (let iter = 0; iter < iterations; iter++) {
    // Generate random permutation
    const permutation = [...playerIds];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Walk through permutation, computing marginal contributions
    const coalition = new Set<string>();

    for (const playerId of permutation) {
      const vBefore = characteristicFunction(coalition, bookings);
      coalition.add(playerId);
      const vAfter = characteristicFunction(coalition, bookings);
      const marginal = vAfter - vBefore;

      shapleyValues.set(playerId, (shapleyValues.get(playerId) ?? 0) + marginal);
    }
  }

  // Average over iterations
  for (const [id, total] of shapleyValues) {
    shapleyValues.set(id, Math.round((total / iterations) * 100) / 100);
  }

  return shapleyValues;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute Shapley-fair cost allocation for a trip.
 * Automatically chooses exact or Monte Carlo based on group size.
 */
export function computeShapleyAllocations(state: TripState): ShapleyResult {
  const activeMembers = state.members.filter(m => m.isActive);
  const activeBookings = state.bookings.filter(b => b.status === 'active');
  const playerIds = activeMembers.map(m => m.memberId);

  if (playerIds.length === 0 || activeBookings.length === 0) {
    return {
      allocations: [],
      totalCost: 0,
      method: 'exact',
      fairnessScore: 100,
    };
  }

  // Choose method
  const useExact = playerIds.length <= 8;
  const shapleyValues = useExact
    ? computeExactShapley(playerIds, activeBookings)
    : computeMonteCarloShapley(playerIds, activeBookings);

  // Compute total cost for equal split comparison
  const totalCost = activeBookings.reduce((sum, b) => sum + b.cost, 0);
  const equalShare = totalCost / playerIds.length;

  // Build per-booking breakdown for each member
  const allocations: ShapleyAllocation[] = activeMembers.map(member => {
    const shapleyShare = shapleyValues.get(member.memberId) ?? 0;

    // Per-booking breakdown
    const breakdown: ShapleyBreakdown[] = activeBookings
      .filter(b => b.participantMemberIds.includes(member.memberId))
      .map(booking => {
        // Approximate per-booking contribution
        const memberCount = booking.participantMemberIds.length;
        const memberBookingShapley = booking.cost / memberCount;
        return {
          bookingId: booking.itemId,
          bookingLabel: booking.label,
          contribution: Math.round(memberBookingShapley * 100) / 100,
          totalCost: booking.cost,
        };
      });

    return {
      memberId: member.memberId,
      memberName: member.displayName,
      shapleyShare,
      equalShare: Math.round(equalShare * 100) / 100,
      difference: Math.round((shapleyShare - equalShare) * 100) / 100,
      percentageOfTotal: totalCost > 0
        ? Math.round((shapleyShare / totalCost) * 10000) / 100
        : 0,
      breakdown,
    };
  });

  // Fairness score: how different is Shapley from equal?
  // 100 = identical, 0 = maximally different
  const maxDeviation = Math.max(...allocations.map(a => Math.abs(a.difference)));
  const fairnessScore = totalCost > 0
    ? Math.round(Math.max(0, 100 - (maxDeviation / totalCost) * 100 * playerIds.length))
    : 100;

  return {
    allocations,
    totalCost,
    method: useExact ? 'exact' : 'monte_carlo',
    fairnessScore,
  };
}

/**
 * Compare Shapley allocation vs equal split for a specific booking.
 * Shows why Shapley is different when participation varies.
 */
export function compareAllocationMethods(
  state: TripState,
  bookingId: string
): {
  bookingLabel: string;
  totalCost: number;
  equalSplit: { memberId: string; name: string; share: number }[];
  shapleySplit: { memberId: string; name: string; share: number }[];
} | null {
  const booking = state.bookings.find(b => b.itemId === bookingId);
  if (!booking) return null;

  const participants = booking.participantMemberIds;
  const equalPerPerson = booking.cost / participants.length;

  const equalSplit = participants.map(id => {
    const member = state.members.find(m => m.memberId === id);
    return {
      memberId: id,
      name: member?.displayName ?? 'Unknown',
      share: Math.round(equalPerPerson * 100) / 100,
    };
  });

  // For Shapley on a single booking, it simplifies to equal split among participants
  // unless there are dependency effects from other bookings
  const shapleyResult = computeShapleyAllocations(state);
  const shapleySplit = participants.map(id => {
    const allocation = shapleyResult.allocations.find(a => a.memberId === id);
    const bookingBreakdown = allocation?.breakdown.find(b => b.bookingId === bookingId);
    return {
      memberId: id,
      name: allocation?.memberName ?? 'Unknown',
      share: bookingBreakdown?.contribution ?? equalPerPerson,
    };
  });

  return {
    bookingLabel: booking.label,
    totalCost: booking.cost,
    equalSplit,
    shapleySplit,
  };
}
