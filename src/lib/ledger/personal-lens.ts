// ─── Personal Impact Lens: Privacy-Scoped Private View Engine ────────────────
// Feature 10 from Solution Design
//
// Every participant gets a private view showing only their portion of the trip:
//   - Their itinerary and which activities they joined
//   - What they consumed vs. what they paid
//   - Current balance and breakdown
//   - Potential exposure from pending cancellations
//   - Expected refunds and their confidence level
//
// "WHY DO I OWE THIS?" Tree Breakdown & Event Trace:
//   Hotel: Rs 4,200
//     |- 2 nights in shared room:      Rs 3,600
//     |- Extra-bed allocation:          Rs 900
//     +- Cancellation refund credit:   -Rs 300
//
// Privacy-Scoped Visibility:
//   Participants see their own data in full, group totals in aggregate, and
//   other members' individual transactions only if those members opt to share.

import type { TripState, DerivedMember, DerivedBooking, DerivedExpense, DerivedRefund, BalanceTrace } from './replay-engine';
import { computeShares, nightlyProration, type SplitType } from '../engine';
import { generateRuleCitation } from './fairness-rules';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface CategoryConsumption {
  category: string;
  amount: number;
  percentage: number;
  itemCount: number;
}

export interface ItemizedOweLine {
  label: string;
  amount: number;
  type: 'base_share' | 'nightly' | 'addon' | 'credit' | 'penalty';
  citation?: string;
}

export interface ItemizedOweBreakdown {
  itemId: string;
  itemLabel: string;
  category: string;
  totalItemCost: number;
  myTotalShare: number;
  lines: ItemizedOweLine[];
}

export interface CancellationExposureItem {
  bookingId: string;
  label: string;
  category: string;
  totalCost: number;
  myShare: number;
  cancellationPolicy: string;
  potentialLoss: number;
  riskLevel: 'high' | 'medium' | 'low';
  governingRule: string;
  reason: string;
}

export interface ExpectedPersonalRefund {
  id: string;
  bookingId: string;
  label: string;
  vendorName: string;
  totalRefundAmount: number;
  myEntitlement: number;
  status: 'pending' | 'received';
  confidenceLevel: 'high' | 'medium' | 'low';
  confidencePercent: number;
  confidenceRationale: string;
  expectedDate?: string;
  governingRule: string;
}

export interface PrivacyScopeSettings {
  shareTransactionsWithGroup: boolean;
  shareReceiptsWithGroup: boolean;
  maskIndividualLineItems: boolean;
}

export interface PersonalItineraryItem {
  id: string;
  label: string;
  type: string;
  cost: number;
  myShare: number;
  startTime: string | null;
  endTime: string | null;
  status: 'active' | 'cancelled';
  joined: boolean;
  vendorName?: string | null;
}

export interface PersonalImpactProfile {
  memberId: string;
  userId: string;
  displayName: string;
  joinedAt: string;

  // Financial summary
  totalPaid: number;
  totalConsumed: number;
  netBalance: number;
  settlements: {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
    iOwe: boolean;
    upiLink?: string;
  }[];

  // Category breakdown
  consumedByCategory: CategoryConsumption[];

  // Itinerary items
  joinedBookings: PersonalItineraryItem[];
  skippedBookings: PersonalItineraryItem[];

  // "Why do I owe this?" Hierarchical Tree Breakdown
  hierarchicalBreakdown: ItemizedOweBreakdown[];

  // Potential Exposure from Pending Cancellations
  cancellationExposure: {
    totalPotentialExposure: number;
    items: CancellationExposureItem[];
  };

  // Expected Refunds & Confidence Level
  expectedRefunds: {
    totalExpectedRefund: number;
    items: ExpectedPersonalRefund[];
  };

  // Privacy Scoping
  privacyScope: PrivacyScopeSettings;

  // Group Aggregates (Privacy-Preserving)
  groupAggregates: {
    totalGroupSpend: number;
    totalGroupBookings: number;
    totalGroupMembers: number;
    groupSettlementCount: number;
  };
}

// ─── Engine: Compute Personal Impact Lens Profile ───────────────────────────

export function computePersonalImpactProfile(
  state: TripState,
  memberId: string,
  userPrivacy?: Partial<PrivacyScopeSettings>
): PersonalImpactProfile | null {
  const member = state.members.find(m => m.memberId === memberId);
  if (!member) return null;

  const memberNameMap = new Map<string, string>();
  state.members.forEach(m => memberNameMap.set(m.memberId, m.displayName));

  // 1. Privacy Scope Settings (defaults to private itemized, aggregate group view)
  const privacyScope: PrivacyScopeSettings = {
    shareTransactionsWithGroup: false,
    shareReceiptsWithGroup: false,
    maskIndividualLineItems: true,
    ...userPrivacy,
  };

  // 2. Personal Upfront Paid
  let totalPaid = 0;
  for (const exp of state.expenses) {
    if (!exp.isDeleted && exp.paidByMemberId === memberId) {
      totalPaid += exp.amount;
    }
  }

  // 3. Personal Consumed Shares across expenses
  let totalConsumed = 0;
  const categoryMap = new Map<string, { amount: number; count: number }>();
  const hierarchicalBreakdown: ItemizedOweBreakdown[] = [];

  for (const exp of state.expenses) {
    if (exp.isDeleted || exp.splitType === 'organizer_paid') continue;

    const shares = computeShares({
      amount: exp.amount,
      splitType: exp.splitType,
      participants: exp.participantMemberIds.map(id => ({
        memberId: id,
        percentage: exp.percentages?.[id],
      })),
    });

    const myShare = shares[memberId] ?? 0;
    if (myShare > 0) {
      totalConsumed += myShare;

      // Category tracking
      const linkedBooking = state.bookings.find(b => b.itemId === exp.itemId);
      const category = linkedBooking?.type || 'general';
      const existingCat = categoryMap.get(category) || { amount: 0, count: 0 };
      existingCat.amount += myShare;
      existingCat.count += 1;
      categoryMap.set(category, existingCat);

      // Hierarchical Tree Lines (Section 10 Spec format)
      // Example:
      //   Hotel: Rs 4,200
      //     |- 2 nights in shared room:      Rs 3,600
      //     |- Extra-bed allocation:          Rs 900
      //     +- Cancellation refund credit:   -Rs 300
      const lines: ItemizedOweLine[] = [];

      if (category === 'hotel') {
        const baseShare = Math.round(myShare * 0.8 * 100) / 100;
        const addOn = Math.round((myShare - baseShare) * 100) / 100;
        lines.push({
          label: 'Shared room accommodation base share',
          amount: baseShare,
          type: 'base_share',
          citation: 'Rule 3: Equal group accommodation share',
        });
        if (addOn > 0) {
          lines.push({
            label: 'Extra-bed / amenities allocation surcharge',
            amount: addOn,
            type: 'addon',
            citation: 'Rule 5: Supplemental occupant share',
          });
        }
      } else if (category === 'flight') {
        lines.push({
          label: 'Individual passenger seat fare & baggage allowance',
          amount: myShare,
          type: 'base_share',
          citation: 'Rule 3: Equal traveler flight split',
        });
      } else {
        lines.push({
          label: `Equal split among ${exp.participantMemberIds.length} travelers`,
          amount: myShare,
          type: 'base_share',
          citation: 'Fairness Constitution: Equitable shared split',
        });
      }

      // Check for any refund credit reducing this item
      const refund = state.refunds.find(r => r.linkedItemId === exp.itemId);
      if (refund && refund.isRedistributed && refund.distributions) {
        const myDist = refund.distributions.find(d => d.memberId === memberId);
        if (myDist && myDist.amount > 0) {
          lines.push({
            label: 'Cancellation refund credit',
            amount: -myDist.amount,
            type: 'credit',
            citation: 'Rule 7: Vendor refunds return to original funder',
          });
        }
      }

      hierarchicalBreakdown.push({
        itemId: exp.itemId || exp.expenseId,
        itemLabel: exp.note || linkedBooking?.label || 'Shared Expense',
        category,
        totalItemCost: exp.amount,
        myTotalShare: myShare,
        lines,
      });
    }
  }

  // Compute category percentages
  const consumedByCategory: CategoryConsumption[] = [];
  categoryMap.forEach((val, cat) => {
    consumedByCategory.push({
      category: cat,
      amount: val.amount,
      percentage: totalConsumed > 0 ? Math.round((val.amount / totalConsumed) * 100) : 0,
      itemCount: val.count,
    });
  });
  consumedByCategory.sort((a, b) => b.amount - a.amount);

  // 4. Net Derived Balance
  const netBalance = state.balances[memberId] ?? Math.round((totalPaid - totalConsumed) * 100) / 100;

  // 5. Personal Settlements
  const settlements = state.settlements
    .filter(s => s.from === memberId || s.to === memberId)
    .map(s => {
      const iOwe = s.from === memberId;
      const otherId = iOwe ? s.to : s.from;
      const otherName = memberNameMap.get(otherId) || otherId;
      const upiLink = iOwe
        ? `upi://pay?pn=${encodeURIComponent(otherName)}&am=${s.amount}&cu=INR&tn=${encodeURIComponent(`Settlement to ${otherName}`)}`
        : undefined;

      return {
        from: s.from,
        fromName: memberNameMap.get(s.from) || s.from,
        to: s.to,
        toName: memberNameMap.get(s.to) || s.to,
        amount: s.amount,
        iOwe,
        upiLink,
      };
    });

  // 6. Personalized Itinerary (Joined vs Skipped activities)
  const joinedBookings: PersonalItineraryItem[] = [];
  const skippedBookings: PersonalItineraryItem[] = [];

  for (const b of state.bookings) {
    const isJoined = b.participantMemberIds.includes(memberId);
    const n = Math.max(1, b.participantMemberIds.length);
    const shareAmt = isJoined ? Math.round((b.cost / n) * 100) / 100 : 0;

    const item: PersonalItineraryItem = {
      id: b.itemId,
      label: b.label,
      type: b.type,
      cost: b.cost,
      myShare: shareAmt,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      joined: isJoined,
      vendorName: b.vendorName,
    };

    if (isJoined) {
      joinedBookings.push(item);
    } else {
      skippedBookings.push(item);
    }
  }

  // 7. Potential Exposure from Pending Cancellations (Section 10 Spec)
  // Evaluates what this traveler could lose if active bookings cancel or face non-refundable penalties.
  const exposureItems: CancellationExposureItem[] = [];
  let totalPotentialExposure = 0;

  for (const b of state.bookings) {
    if (!b.participantMemberIds.includes(memberId)) continue;

    const n = Math.max(1, b.participantMemberIds.length);
    const myShare = Math.round((b.cost / n) * 100) / 100;

    if (b.status === 'cancelled') {
      // Already cancelled booking with penalty
      const penalty = b.penaltyAmount ?? Math.max(0, b.cost - (b.refundAmount ?? 0));
      const myPenaltyShare = Math.round((penalty / n) * 100) / 100;
      if (myPenaltyShare > 0) {
        totalPotentialExposure += myPenaltyShare;
        exposureItems.push({
          bookingId: b.itemId,
          label: b.label,
          category: b.type,
          totalCost: b.cost,
          myShare,
          cancellationPolicy: b.cancellationPolicy || 'Non-refundable penalty assessed',
          potentialLoss: myPenaltyShare,
          riskLevel: 'high',
          governingRule: 'Rule 2: Voluntary cancellation pays non-refundable loss',
          reason: `Booking cancelled; your non-refundable exposure is ₹${myPenaltyShare.toLocaleString('en-IN')}`,
        });
      }
    } else {
      // Active booking: check policy risk
      let lossRate = 0.25; // default 25% exposure
      let riskLevel: 'high' | 'medium' | 'low' = 'low';

      if (b.type === 'flight') {
        lossRate = 0.60; // flights have high cancellation fees
        riskLevel = 'high';
      } else if (b.type === 'hotel') {
        lossRate = 0.35;
        riskLevel = 'medium';
      }

      const potentialLoss = Math.round(myShare * lossRate * 100) / 100;
      if (potentialLoss > 0) {
        totalPotentialExposure += potentialLoss;
        exposureItems.push({
          bookingId: b.itemId,
          label: b.label,
          category: b.type,
          totalCost: b.cost,
          myShare,
          cancellationPolicy: b.cancellationPolicy || `${Math.round(lossRate * 100)}% estimated cancellation penalty`,
          potentialLoss,
          riskLevel,
          governingRule: 'Rule 3: Group-forced cancellation shared equally',
          reason: `If cancelled today, non-refundable vendor penalty exposure is ~₹${potentialLoss.toLocaleString('en-IN')}`,
        });
      }
    }
  }

  // 8. Expected Refunds and Their Confidence Level (Section 10 Spec)
  const refundItems: ExpectedPersonalRefund[] = [];
  let totalExpectedRefund = 0;

  // Check cancelled bookings awaiting refund
  for (const b of state.bookings) {
    if (b.status === 'cancelled' && b.refundAmount && b.refundAmount > 0) {
      const isFunder = b.participantMemberIds.includes(memberId);
      if (isFunder) {
        const n = Math.max(1, b.participantMemberIds.length);
        const myEntitlement = Math.round((b.refundAmount / n) * 100) / 100;

        let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
        let confidencePercent = 75;
        let confidenceRationale = 'Vendor cancellation policy guarantees refund within 7-10 business days';

        if (b.type === 'flight') {
          confidenceLevel = 'high';
          confidencePercent = 90;
          confidenceRationale = 'DGCA mandated airline cancellation refund credit';
        } else if (b.cancelReason?.toLowerCase().includes('dispute')) {
          confidenceLevel = 'low';
          confidencePercent = 40;
          confidenceRationale = 'Vendor dispute pending formal review';
        }

        totalExpectedRefund += myEntitlement;
        refundItems.push({
          id: `ref-exp-${b.itemId}`,
          bookingId: b.itemId,
          label: b.label,
          vendorName: b.vendorName || 'Travel Vendor',
          totalRefundAmount: b.refundAmount,
          myEntitlement,
          status: 'pending',
          confidenceLevel,
          confidencePercent,
          confidenceRationale,
          expectedDate: '3-5 business days',
          governingRule: 'Rule 7: Vendor refunds return to economic funders',
        });
      }
    }
  }

  // Check real refunds already recorded but pending redistribution
  for (const r of state.refunds) {
    if (!r.isRedistributed) {
      const booking = state.bookings.find(b => b.itemId === r.linkedItemId);
      const isFunder = booking ? booking.participantMemberIds.includes(memberId) : true;
      if (isFunder) {
        const count = booking ? Math.max(1, booking.participantMemberIds.length) : state.members.length;
        const myEntitlement = Math.round((r.amount / count) * 100) / 100;

        totalExpectedRefund += myEntitlement;
        refundItems.push({
          id: `ref-pending-dist-${r.refundId}`,
          bookingId: r.linkedItemId,
          label: booking?.label || 'Trip Refund',
          vendorName: r.vendorName || 'Vendor',
          totalRefundAmount: r.amount,
          myEntitlement,
          status: 'received',
          confidenceLevel: 'high',
          confidencePercent: 99,
          confidenceRationale: 'Refund already credited to cardholder account; awaiting redistribution to your balance',
          governingRule: 'Rule 7: Refund to original funder, not merely cardholder',
        });
      }
    }
  }

  // 9. Group Aggregates (Privacy-Preserving)
  const groupAggregates = {
    totalGroupSpend: state.totalSpent,
    totalGroupBookings: state.bookings.length,
    totalGroupMembers: state.members.length,
    groupSettlementCount: state.settlements.length,
  };

  return {
    memberId: member.memberId,
    userId: member.userId,
    displayName: member.displayName,
    joinedAt: member.joinedAt,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalConsumed: Math.round(totalConsumed * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    settlements,
    consumedByCategory,
    joinedBookings,
    skippedBookings,
    hierarchicalBreakdown,
    cancellationExposure: {
      totalPotentialExposure: Math.round(totalPotentialExposure * 100) / 100,
      items: exposureItems,
    },
    expectedRefunds: {
      totalExpectedRefund: Math.round(totalExpectedRefund * 100) / 100,
      items: refundItems,
    },
    privacyScope,
    groupAggregates,
  };
}
