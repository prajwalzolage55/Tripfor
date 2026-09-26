// ─── Settlement Router Unit Tests ───────────────────────────────────────────
// Tests Section 7: Minimum-Transaction Graph, Debt-Netting, In-Flight Refunds,
// and the 6 Payment State Classifications.

import assert from 'node:assert/strict';
import { test } from 'node:test';

// Import router module functions
import {
  extractRawDebts,
  extractSpecialObligations,
  computeSettlementRouting,
  getSection7BenchmarkScenario,
  getPaymentStateMeta,
  PAYMENT_STATE_META,
} from '../ledger/settlement-router.ts';

test('1. Section 7 Canonical Benchmark Scenario Verification', () => {
  const benchmark = getSection7BenchmarkScenario({ a: 'Alice', b: 'Bob', c: 'Charlie' });
  const { plan } = benchmark;

  // Verify Raw Transfer Count (A owes B, B owes C, C owes A = 3 raw debts)
  assert.equal(plan.rawTransferCount, 3, 'Should have 3 pairwise raw debts');

  // Verify Optimized Transfer Count (Debt netting simplifies to 2 transfers)
  assert.equal(plan.optimizedTransferCount, 2, 'Should simplify down to 2 transfers');

  // Verify Redundant Transfer Savings
  assert.equal(plan.savingsCount, 1, 'Should eliminate 1 redundant transfer');

  // Verify In-flight Vendor Refund detection (Grand Hotel owes Bob Rs 700)
  assert.equal(plan.vendorObligations.length, 1, 'Should detect 1 pending vendor refund');
  assert.equal(plan.vendorObligations[0].vendorName, 'Grand Hotel');
  assert.equal(plan.vendorObligations[0].amount, 700);
  assert.equal(plan.vendorObligations[0].recipientMemberId, 'mem_b');

  // Verify Payment State Classifications:
  // Transfer to Bob (mem_b) must be held as 'pay_after_refund' because Bob is waiting for Rs 700 hotel refund
  const transferToBob = plan.transfers.find(t => t.toMemberId === 'mem_b');
  assert.ok(transferToBob, 'Should have a transfer to Bob');
  assert.equal(transferToBob.state, 'pay_after_refund', 'Transfer to Bob must be held in pay_after_refund state');
  assert.equal(transferToBob.amount, 500, 'Transfer amount must be 500');

  // Transfer to Charlie (mem_c) must be 'pay_now' because Charlie has no pending vendor refunds
  const transferToCharlie = plan.transfers.find(t => t.toMemberId === 'mem_c');
  assert.ok(transferToCharlie, 'Should have a transfer to Charlie');
  assert.equal(transferToCharlie.state, 'pay_now', 'Transfer to Charlie must be pay_now');
  assert.equal(transferToCharlie.amount, 500, 'Transfer amount must be 500');

  // Verify Router Advisory matches specification:
  // "Wait for the hotel refund, then complete 2 transfers instead of 5."
  assert.match(
    plan.routerAdvisory,
    /Wait for the Grand Hotel refund.*2 transfers instead of/,
    'Router advisory must instruct to wait for hotel refund and quote reduced transfers'
  );
});

test('2. 6 Payment State Metadata Integrity', () => {
  const expectedStates = [
    'pay_now',
    'pay_after_refund',
    'vendor_owes',
    'provisionally_disputed',
    'covered_by_organizer',
    'non_cash_voucher',
  ];

  for (const s of expectedStates) {
    const meta = getPaymentStateMeta(s);
    assert.ok(meta, `Metadata for state "${s}" must exist`);
    assert.ok(meta.label.length > 0, `Label for state "${s}" must not be empty`);
    assert.ok(meta.dotColor.startsWith('#'), `Dot color for state "${s}" must be hex`);
    assert.ok(meta.description.length > 0, `Description for state "${s}" must not be empty`);
  }
});

test('3. Circular Debt Netting Elimination (A->B 1000, B->C 1000, C->A 1000)', () => {
  const circularState = {
    tripId: 'circular-trip',
    tripName: 'Circular Trip',
    destination: 'Goa',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'CIRC-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'A', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm2', userId: 'u2', displayName: 'B', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm3', userId: 'u3', displayName: 'C', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [],
    expenses: [
      {
        expenseId: 'e1',
        itemId: null,
        amount: 1000,
        currency: 'INR',
        paidByMemberId: 'm2',
        splitType: 'equal',
        participantMemberIds: ['m1'],
        note: 'B paid for A',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-01',
      },
      {
        expenseId: 'e2',
        itemId: null,
        amount: 1000,
        currency: 'INR',
        paidByMemberId: 'm3',
        splitType: 'equal',
        participantMemberIds: ['m2'],
        note: 'C paid for B',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-02',
      },
      {
        expenseId: 'e3',
        itemId: null,
        amount: 1000,
        currency: 'INR',
        paidByMemberId: 'm1',
        splitType: 'equal',
        participantMemberIds: ['m3'],
        note: 'A paid for C',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-03',
      },
    ],
    payments: [],
    refunds: [],
    balances: { m1: 0, m2: 0, m3: 0 },
    settlements: [],
    totalSpent: 3000,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 3,
    lastEventVersion: 3,
    lastEventTimestamp: '2026-09-03T10:00:00Z',
    constitution: [],
  };

  const plan = computeSettlementRouting(circularState);
  assert.equal(plan.rawTransferCount, 3, 'Raw pairwise debts should be 3');
  assert.equal(plan.optimizedTransferCount, 0, 'Circular debt netting should completely eliminate all transfers (0 needed)');
  assert.equal(plan.savingsCount, 3, 'All 3 transfers should be saved');
  assert.match(plan.routerAdvisory, /All balances are perfectly settled/);
});

test('4. Dispute Isolation and Non-Cash Voucher Detection', () => {
  const disputeState = {
    tripId: 'dispute-trip',
    tripName: 'Dispute Trip',
    destination: 'Kerala',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'DISP-1',
    members: [
      { memberId: 'm1', userId: 'u1', displayName: 'Prajwal', joinedAt: '2026-09-01', isActive: true },
      { memberId: 'm2', userId: 'u2', displayName: 'Anurag', joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'b1',
        type: 'flight',
        label: 'Flight to Kochi',
        cost: 3000,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['m1'],
        startTime: '2026-09-01',
        endTime: '2026-09-01',
        vendorName: 'IndiGo Airlines',
        cancellationPolicy: 'Voucher only',
        status: 'cancelled',
        refundAmount: 3000,
        cancelReason: 'IndiGo issued flight voucher credit instead of cash',
        createdAt: '2026-09-01',
      },
    ],
    expenses: [
      {
        expenseId: 'e1',
        itemId: null,
        amount: 1500,
        currency: 'INR',
        paidByMemberId: 'm1',
        splitType: 'equal',
        participantMemberIds: ['m1', 'm2'],
        note: 'Dinner bar bill [DISPUTED share]',
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-01',
      },
    ],
    payments: [],
    refunds: [],
    balances: { m1: 750, m2: -750 },
    settlements: [{ from: 'm2', to: 'm1', amount: 750 }],
    totalSpent: 1500,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 2,
    lastEventVersion: 2,
    lastEventTimestamp: '2026-09-01T10:00:00Z',
    constitution: [],
  };

  const plan = computeSettlementRouting(disputeState);

  // Should isolate disputed expense
  assert.equal(plan.disputedItems.length, 1, 'Should detect 1 disputed item');
  assert.equal(plan.disputedItems[0].disputerName, 'Anurag');

  // Should detect non-cash voucher from booking cancellation
  assert.equal(plan.vouchers.length, 1, 'Should detect 1 non-cash voucher');
  assert.equal(plan.vouchers[0].issuer, 'IndiGo Airlines');
  assert.equal(plan.vouchers[0].value, 3000);
});
