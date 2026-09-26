// ─── Calculation Engine ─────────────────────────────────────────────────────
// Rule zero: balances are always derived, never stored as truth.
// Recompute from expenses + item_participants every time.

export type SplitType = 'equal' | 'flat_per_person' | 'per_night' | 'percentage' | 'organizer_paid';

// --- Step 1: compute each participant's share of a single expense ---
export interface ExpenseShareInput {
  amount: number;
  splitType: SplitType;
  participants: { memberId: string; percentage?: number }[];
}

export function computeShares(input: ExpenseShareInput): Record<string, number> {
  const { amount, splitType, participants } = input;
  const shares: Record<string, number> = {};
  const n = participants.length;
  if (n === 0) return shares;

  if (splitType === 'equal') {
    const base = Math.floor((amount / n) * 100) / 100;
    const remainderCents = Math.round((amount - base * n) * 100);
    participants.forEach((p, i) => {
      shares[p.memberId] = base + (i < remainderCents ? 0.01 : 0);
    });
  } else if (splitType === 'flat_per_person') {
    // `amount` here is the PER-PERSON cost, not the total
    participants.forEach(p => { shares[p.memberId] = amount; });
  } else if (splitType === 'percentage') {
    participants.forEach(p => {
      shares[p.memberId] = Math.round(amount * (p.percentage ?? 0)) / 100;
    });
  } else if (splitType === 'organizer_paid') {
    // Entire cost belongs to the payer alone — excluded from the shared ledger entirely
  }
  return shares;
}

// --- Step 1b: per-night room proration ---
export function nightlyProration(
  nightlyRate: number,
  nights: { date: string; occupants: string[] }[]
): Record<string, number> {
  const shares: Record<string, number> = {};
  for (const night of nights) {
    const perPerson = nightlyRate / night.occupants.length;
    for (const id of night.occupants) shares[id] = (shares[id] ?? 0) + perPerson;
  }
  for (const id in shares) shares[id] = Math.round(shares[id] * 100) / 100;
  return shares;
}

// --- Step 2: net balance per member across all expenses ---
export interface ComputedExpense {
  amount: number;
  paidBy: string;
  splitType: SplitType;
  shares: Record<string, number>; // output of computeShares() / nightlyProration()
}

export function computeNetBalances(expenses: ComputedExpense[], memberIds: string[]): Record<string, number> {
  const balance: Record<string, number> = {};
  memberIds.forEach(id => (balance[id] = 0));

  for (const exp of expenses) {
    if (exp.splitType === 'organizer_paid') continue;
    balance[exp.paidBy] = (balance[exp.paidBy] ?? 0) + exp.amount;
    for (const [memberId, share] of Object.entries(exp.shares)) {
      balance[memberId] = (balance[memberId] ?? 0) - share;
    }
  }
  // Round to avoid floating point drift
  for (const id in balance) {
    balance[id] = Math.round(balance[id] * 100) / 100;
  }
  return balance; // positive = is owed money, negative = owes money
}

// --- Step 3: simplify debts into the minimum number of payments ---
export interface Settlement { from: string; to: string; amount: number; }

export function simplifyDebts(balances: Record<string, number>): Settlement[] {
  const EPS = 0.01;
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > EPS).map(([id, b]) => ({ id, amount: b }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -EPS).map(([id, b]) => ({ id, amount: -b }))
    .sort((a, b) => b.amount - a.amount);

  const result: Settlement[] = [];
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

// --- Full pipeline: from raw DB data to settlements ---
export interface RawExpense {
  id: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  itemId: string | null;
  participants: { memberId: string; percentage?: number }[];
}

export function computeSettlements(
  expenses: RawExpense[],
  memberIds: string[],
  cancelledItemIds: Set<string>
): { balances: Record<string, number>; settlements: Settlement[]; expenseDetails: ComputedExpense[] } {
  // Filter out expenses tied to cancelled items
  const activeExpenses = expenses.filter(e => !e.itemId || !cancelledItemIds.has(e.itemId));

  const computed: ComputedExpense[] = activeExpenses.map(exp => ({
    amount: exp.amount,
    paidBy: exp.paidBy,
    splitType: exp.splitType,
    shares: computeShares({
      amount: exp.amount,
      splitType: exp.splitType,
      participants: exp.participants,
    }),
  }));

  const balances = computeNetBalances(computed, memberIds);
  const settlements = simplifyDebts(balances);
  return { balances, settlements, expenseDetails: computed };
}
