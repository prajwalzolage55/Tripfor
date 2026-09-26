// ─── Personal Impact Lens Unit Tests ─────────────────────────────────────────
// Tests Section 10: Private Personal View, "Why do I owe this?" Hierarchical Tree,
// Cancellation Exposure, Expected Refunds & Confidence, and Privacy-Scoped Visibility.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computePersonalImpactProfile } from '../ledger/personal-lens.ts';

test('1. Personal Impact Lens: Consumption vs Paid and Net Balance Calculation', () => {
  const sampleState = {
    tripId: 'lens-trip',
    tripName: 'Manali Lens Test',
    destination: 'Manali',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'LENS-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Prajwal', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm2', userId: 'u2', displayName: 'Anurag', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'b_hotel',
        type: 'hotel',
        label: 'Grand Himalayan Resort',
        cost: 4200,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['m1', 'm2'],
        startTime: '2026-09-01',
        endTime: '2026-09-03',
        vendorName: 'Grand Hotel',
        cancellationPolicy: '30% non-refundable deposit',
        status: 'active',
        createdAt: '2026-09-01',
      },
    ],
    expenses: [
      {
        expenseId: 'e1',
        itemId: 'b_hotel',
        amount: 4200,
        currency: 'INR',
        paidByMemberId: 'm1',
        splitType: 'equal',
        participantMemberIds: ['m1', 'm2'],
        note: 'Grand Himalayan Resort booking',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-01',
      },
    ],
    payments: [],
    refunds: [],
    balances: { m1: 2100, m2: -2100 },
    settlements: [{ from: 'm2', to: 'm1', amount: 2100 }],
    totalSpent: 4200,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 1,
    lastEventVersion: 1,
    lastEventTimestamp: '2026-09-01T10:00:00Z',
    constitution: [],
  };

  // Inspect profile for Prajwal (Payer)
  const profilePayer = computePersonalImpactProfile(sampleState, 'm1');
  assert.ok(profilePayer, 'Profile for m1 must exist');
  assert.equal(profilePayer.totalPaid, 4200, 'm1 paid Rs 4,200 upfront');
  assert.equal(profilePayer.totalConsumed, 2100, 'm1 consumed share is Rs 2,100');
  assert.equal(profilePayer.netBalance, 2100, 'm1 net balance must be +2,100 (is owed money)');

  // Inspect profile for Anurag (Debtor)
  const profileDebtor = computePersonalImpactProfile(sampleState, 'm2');
  assert.ok(profileDebtor, 'Profile for m2 must exist');
  assert.equal(profileDebtor.totalPaid, 0, 'm2 paid Rs 0 upfront');
  assert.equal(profileDebtor.totalConsumed, 2100, 'm2 consumed share is Rs 2,100');
  assert.equal(profileDebtor.netBalance, -2100, 'm2 net balance must be -2,100 (owes money)');
});

test('2. "Why Do I Owe This?" Hierarchical Tree Breakdown (Section 10 Spec Matcher)', () => {
  const sampleState = {
    tripId: 'lens-tree-trip',
    tripName: 'Hotel Tree Test',
    destination: 'Goa',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'TREE-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Sam', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'b_hotel',
        type: 'hotel',
        label: 'Beachside Villa',
        cost: 4200,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['m1'],
        startTime: '2026-09-01',
        endTime: '2026-09-03',
        vendorName: 'Beachside Villa',
        status: 'active',
        createdAt: '2026-09-01',
      },
    ],
    expenses: [
      {
        expenseId: 'e1',
        itemId: 'b_hotel',
        amount: 4200,
        currency: 'INR',
        paidByMemberId: 'organizer',
        splitType: 'equal',
        participantMemberIds: ['m1'],
        note: 'Beachside Villa',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-01',
      },
    ],
    payments: [],
    refunds: [
      {
        refundId: 'ref_1',
        linkedItemId: 'b_hotel',
        amount: 300,
        currency: 'INR',
        receivedByMemberId: 'organizer',
        vendorName: 'Beachside Villa',
        isFullRefund: false,
        isRedistributed: true,
        distributions: [{ memberId: 'm1', amount: 300 }],
        receivedAt: '2026-09-02T10:00:00Z',
      },
    ],
    balances: { m1: -3900 },
    settlements: [{ from: 'm1', to: 'organizer', amount: 3900 }],
    totalSpent: 4200,
    totalRefunded: 300,
    totalSettled: 0,
    eventCount: 2,
    lastEventVersion: 2,
    lastEventTimestamp: '2026-09-02T10:00:00Z',
    constitution: [],
  };

  const profile = computePersonalImpactProfile(sampleState, 'm1');
  assert.ok(profile, 'Profile must exist');
  assert.equal(profile.hierarchicalBreakdown.length, 1, 'Should have 1 hierarchical breakdown item');

  const breakdown = profile.hierarchicalBreakdown[0];
  assert.equal(breakdown.category, 'hotel');
  assert.equal(breakdown.totalItemCost, 4200);

  // Must have base share, add-on/surcharge, and refund credit lines
  const hasBaseShare = breakdown.lines.some(l => l.type === 'base_share');
  const hasAddon = breakdown.lines.some(l => l.type === 'addon');
  const hasCredit = breakdown.lines.some(l => l.type === 'credit' && l.amount < 0);

  assert.ok(hasBaseShare, 'Hierarchical breakdown must include base share line');
  assert.ok(hasAddon, 'Hierarchical breakdown must include extra-bed/surcharge line');
  assert.ok(hasCredit, 'Hierarchical breakdown must include cancellation refund credit line');
});

test('3. Potential Exposure from Pending Cancellations', () => {
  const exposureState = {
    tripId: 'exposure-trip',
    tripName: 'Exposure Test',
    destination: 'Kashmir',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'EXP-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Prajwal', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'b_flight',
        type: 'flight',
        label: 'Air India Srinagar Flight',
        cost: 6000,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['m1'],
        startTime: '2026-09-01',
        endTime: '2026-09-01',
        vendorName: 'Air India',
        cancellationPolicy: 'Non-refundable airline ticket',
        status: 'active',
        createdAt: '2026-09-01',
      },
    ],
    expenses: [],
    payments: [],
    refunds: [],
    balances: { m1: 0 },
    settlements: [],
    totalSpent: 6000,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 1,
    lastEventVersion: 1,
    lastEventTimestamp: '2026-09-01T10:00:00Z',
    constitution: [],
  };

  const profile = computePersonalImpactProfile(exposureState, 'm1');
  assert.ok(profile, 'Profile must exist');
  assert.ok(profile.cancellationExposure.totalPotentialExposure > 0, 'Flight must have potential cancellation exposure');
  assert.equal(profile.cancellationExposure.items[0].riskLevel, 'high', 'Flight cancellation should be marked high risk');
});

test('4. Expected Refunds and Confidence Levels (Rule 7 Funder Protection)', () => {
  const refundState = {
    tripId: 'refund-trip',
    tripName: 'Refund Confidence Test',
    destination: 'Ladakh',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'REF-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Prajwal', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm2', userId: 'u2', displayName: 'Anurag', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'b_flight_cancelled',
        type: 'flight',
        label: 'Indigo Flight',
        cost: 5000,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['m1', 'm2'],
        startTime: '2026-09-01',
        endTime: '2026-09-01',
        vendorName: 'IndiGo',
        status: 'cancelled',
        refundAmount: 4000,
        createdAt: '2026-09-01',
      },
    ],
    expenses: [],
    payments: [],
    refunds: [],
    balances: { m1: 0, m2: 0 },
    settlements: [],
    totalSpent: 5000,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 1,
    lastEventVersion: 1,
    lastEventTimestamp: '2026-09-01T10:00:00Z',
    constitution: [],
  };

  const profile = computePersonalImpactProfile(refundState, 'm1');
  assert.ok(profile, 'Profile must exist');
  assert.equal(profile.expectedRefunds.items.length, 1, 'Should detect 1 expected refund item');

  const refItem = profile.expectedRefunds.items[0];
  assert.equal(refItem.myEntitlement, 2000, 'm1 entitlement should be 50% of Rs 4000 = Rs 2000');
  assert.equal(refItem.confidenceLevel, 'high', 'Flight refund under airline mandate should have high confidence');
  assert.equal(refItem.confidencePercent, 90, 'High confidence percent should be 90%');
});

test('5. Privacy-Scoped Visibility Invariants', () => {
  const privacyState = {
    tripId: 'privacy-trip',
    tripName: 'Privacy Scope Test',
    destination: 'Jaipur',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'PRIV-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Prajwal', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm2', userId: 'u2', displayName: 'Viraj', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [],
    expenses: [],
    payments: [],
    refunds: [],
    balances: { m1: 0, m2: 0 },
    settlements: [],
    totalSpent: 12500,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 1,
    lastEventVersion: 1,
    lastEventTimestamp: '2026-09-01T10:00:00Z',
    constitution: [],
  };

  const defaultProfile = computePersonalImpactProfile(privacyState, 'm1');
  assert.ok(defaultProfile, 'Profile must exist');
  assert.equal(defaultProfile.privacyScope.shareTransactionsWithGroup, false, 'Default privacy should be private (not shared)');
  assert.equal(defaultProfile.groupAggregates.totalGroupSpend, 12500, 'Group spend aggregate must be accurately available');
  assert.equal(defaultProfile.groupAggregates.totalGroupMembers, 2, 'Group members count aggregate must be available');
});
