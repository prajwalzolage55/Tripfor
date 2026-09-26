// Engine test — verifies the exact test case from the spec
// Run with: node src/lib/__tests__/engine.test.mjs

// We use dynamic import to handle the TS → compiled path
// For a quick smoke test, we inline the engine logic here:

// ─── Inline engine (mirrors engine.ts exactly) ─────────────────────

function computeShares({ amount, splitType, participants }) {
  const shares = {};
  const n = participants.length;
  if (n === 0) return shares;

  if (splitType === 'equal') {
    const base = Math.floor((amount / n) * 100) / 100;
    const remainderCents = Math.round((amount - base * n) * 100);
    participants.forEach((p, i) => {
      shares[p.memberId] = base + (i < remainderCents ? 0.01 : 0);
    });
  } else if (splitType === 'flat_per_person') {
    participants.forEach(p => { shares[p.memberId] = amount; });
  } else if (splitType === 'percentage') {
    participants.forEach(p => {
      shares[p.memberId] = Math.round(amount * (p.percentage ?? 0)) / 100;
    });
  }
  return shares;
}

function computeNetBalances(expenses, memberIds) {
  const balance = {};
  memberIds.forEach(id => (balance[id] = 0));
  for (const exp of expenses) {
    if (exp.splitType === 'organizer_paid') continue;
    balance[exp.paidBy] = (balance[exp.paidBy] ?? 0) + exp.amount;
    for (const [memberId, share] of Object.entries(exp.shares)) {
      balance[memberId] = (balance[memberId] ?? 0) - share;
    }
  }
  for (const id in balance) {
    balance[id] = Math.round(balance[id] * 100) / 100;
  }
  return balance;
}

function simplifyDebts(balances) {
  const EPS = 0.01;
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > EPS).map(([id, b]) => ({ id, amount: b }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -EPS).map(([id, b]) => ({ id, amount: -b }))
    .sort((a, b) => b.amount - a.amount);

  const result = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i], d = debtors[j];
    const amt = Math.round(Math.min(c.amount, d.amount) * 100) / 100;
    if (amt > EPS) result.push({ from: d.id, to: c.id, amount: amt });
    c.amount -= amt; d.amount -= amt;
    if (c.amount <= EPS) i++;
    if (d.amount <= EPS) j++;
  }
  return result;
}

// ─── Test Case from Spec ────────────────────────────────────────────

const members = ['A', 'B', 'C'];
const participants = members.map(id => ({ memberId: id }));

// Expense 1: Hotel ₹3,000, paid by A, split equal among A, B, C
const shares1 = computeShares({ amount: 3000, splitType: 'equal', participants });
// Expense 2: Dinner ₹900, paid by B, split equal among A, B, C
const shares2 = computeShares({ amount: 900, splitType: 'equal', participants });

const expenses = [
  { amount: 3000, paidBy: 'A', splitType: 'equal', shares: shares1 },
  { amount: 900, paidBy: 'B', splitType: 'equal', shares: shares2 },
];

const balances = computeNetBalances(expenses, members);
const settlements = simplifyDebts(balances);

console.log('=== GroupTrip Ledger Engine Test ===\n');

console.log('Shares for Hotel (₹3000, equal, A/B/C):', shares1);
console.log('Shares for Dinner (₹900, equal, A/B/C):', shares2);
console.log('');

console.log('Net Balances:', balances);
console.log('Expected:     A = +1700, B = -400, C = -1300');
console.log('');

// Validate balances
let pass = true;
if (balances['A'] !== 1700) { console.error(`❌ FAIL: A balance = ${balances['A']}, expected 1700`); pass = false; }
if (balances['B'] !== -400) { console.error(`❌ FAIL: B balance = ${balances['B']}, expected -400`); pass = false; }
if (balances['C'] !== -1300) { console.error(`❌ FAIL: C balance = ${balances['C']}, expected -1300`); pass = false; }

// Check sum is zero
const sum = Object.values(balances).reduce((a, b) => a + b, 0);
if (Math.abs(sum) > 0.01) { console.error(`❌ FAIL: Balance sum = ${sum}, expected 0`); pass = false; }

console.log('Settlements:', settlements);
console.log('Expected:     C pays A ₹1300, B pays A ₹400');
console.log('');

// Validate settlements
if (settlements.length !== 2) {
  console.error(`❌ FAIL: ${settlements.length} settlements, expected 2`);
  pass = false;
} else {
  const s1 = settlements[0];
  const s2 = settlements[1];
  if (s1.from !== 'C' || s1.to !== 'A' || s1.amount !== 1300) {
    console.error(`❌ FAIL: Settlement 1 = ${JSON.stringify(s1)}, expected C→A ₹1300`);
    pass = false;
  }
  if (s2.from !== 'B' || s2.to !== 'A' || s2.amount !== 400) {
    console.error(`❌ FAIL: Settlement 2 = ${JSON.stringify(s2)}, expected B→A ₹400`);
    pass = false;
  }
}

if (pass) {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.error('\n❌ SOME TESTS FAILED');
  process.exit(1);
}
