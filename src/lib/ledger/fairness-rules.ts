// ─── Fairness Constitution: Rule Engine ─────────────────────────────────────
// Before the trip, the group selects or creates explicit rules governing edge cases.
// Every recalculation cites the applicable rule — eliminating the most common
// group-travel conflict: disagreement over what "fair" means.

// ─── Rule Types ─────────────────────────────────────────────────────────────

export type FairnessRuleId =
  | 'late_joiner_no_prior_costs'
  | 'voluntary_cancel_pays_loss'
  | 'group_cancel_shared_equally'
  | 'children_half_share'
  | 'couples_shared_room'
  | 'organizer_no_cancel_risk'
  | 'refund_to_funder'
  | 'early_leaver_pays_committed'
  | 'minimum_contribution_cap'
  | string;

export interface FairnessRule {
  id: FairnessRuleId;
  ruleNumber: number;
  name: string;
  description: string;
  category: 'joining' | 'leaving' | 'accommodation' | 'cancellation' | 'refund' | 'general';
  isDefault: boolean;        // part of the default constitution
  isEnabled: boolean;        // whether the group has this rule active
  priority: number;          // lower = higher priority (for conflict resolution)
  parameters?: Record<string, any>;  // configurable thresholds
  exampleTrace: string;      // concrete illustration matching spec
}

export interface RuleCitation {
  ruleNumber: number;
  ruleId: FairnessRuleId;
  ruleName: string;
  explanation: string;
  appliedAt: string;         // ISO timestamp
  affectedMembers: string[];
  financialImpact: number;   // the amount this rule affected
}

// ─── The 7 Canonical Specification Rules ────────────────────────────────────

export const DEFAULT_CONSTITUTION: FairnessRule[] = [
  {
    id: 'late_joiner_no_prior_costs',
    ruleNumber: 1,
    name: 'Late Joiner Protection',
    description: 'A late joiner does not share costs incurred before joining.',
    category: 'joining',
    isDefault: true,
    isEnabled: true,
    priority: 1,
    exampleTrace: 'Rahul joined on Day 3. Under Rule 1 (Late Joiner Protection), costs incurred before Day 3 are excluded from Rahul\'s balance.',
  },
  {
    id: 'voluntary_cancel_pays_loss',
    ruleNumber: 2,
    name: 'Voluntary Cancellation Responsibility',
    description: 'A voluntary cancellation pays any non-refundable loss caused by leaving.',
    category: 'cancellation',
    isDefault: true,
    isEnabled: true,
    priority: 2,
    exampleTrace: 'Meera\'s balance increased by ₹750 because Room 3 changed from four occupants to three. Under Rule 2 (Voluntary Cancellation Responsibility), voluntary withdrawal costs remain assigned to the withdrawing participant until a replacement joins.',
  },
  {
    id: 'group_cancel_shared_equally',
    ruleNumber: 3,
    name: 'Group-Forced Cancellation Solidarity',
    description: 'A group-forced cancellation is shared equally by all affected participants.',
    category: 'cancellation',
    isDefault: true,
    isEnabled: true,
    priority: 3,
    exampleTrace: 'Safari was cancelled due to heavy rain. Under Rule 3 (Group-Forced Cancellation Solidarity), the vendor penalty is shared equally among all signed-up travelers.',
  },
  {
    id: 'children_half_share',
    ruleNumber: 4,
    name: 'Children Half-Share',
    description: 'Children count as 0.5 shares for accommodation.',
    category: 'accommodation',
    isDefault: true,
    isEnabled: true,
    priority: 4,
    parameters: { accommodationWeight: 0.5 },
    exampleTrace: 'Under Rule 4 (Children Half-Share), child dependents are billed at 50% for family resort suites while adults pay 1.0 share.',
  },
  {
    id: 'couples_shared_room',
    ruleNumber: 5,
    name: 'Couples Shared Room',
    description: 'Couples may share one room share but retain individual activity shares.',
    category: 'accommodation',
    isDefault: true,
    isEnabled: true,
    priority: 5,
    exampleTrace: 'Under Rule 5 (Couples Shared Room), couples share 1 accommodation billing unit but each pay separate tickets for rafting.',
  },
  {
    id: 'organizer_no_cancel_risk',
    ruleNumber: 6,
    name: 'Organizer Protection',
    description: 'The organizer fronts deposits but does not automatically bear cancellation risk.',
    category: 'general',
    isDefault: true,
    isEnabled: true,
    priority: 6,
    exampleTrace: 'Organizer fronted the ₹25,000 villa security deposit. Under Rule 6 (Organizer Protection), cancellation shortfall is legally indemnified by the group.',
  },
  {
    id: 'refund_to_funder',
    ruleNumber: 7,
    name: 'Refund to Economic Funder',
    description: 'Vendor refunds return to the people who economically funded the booking, not merely to the cardholder.',
    category: 'refund',
    isDefault: true,
    isEnabled: true,
    priority: 7,
    exampleTrace: 'Airlines refunded ₹12,000 to organizer\'s card. Under Rule 7 (Refund to Economic Funder), the credit returns proportionally to the 4 members who funded the ticket.',
  },
  {
    id: 'early_leaver_pays_committed',
    ruleNumber: 8,
    name: 'Early Leaver Commitment',
    description: 'A member who leaves early is still responsible for costs that were pre-committed on their behalf.',
    category: 'leaving',
    isDefault: true,
    isEnabled: true,
    priority: 8,
    exampleTrace: 'Under Rule 8 (Early Leaver Commitment), pre-booked transfers and accommodation nights remain payable unless replaced by a new traveler.',
  },
  {
    id: 'minimum_contribution_cap',
    ruleNumber: 9,
    name: 'Minimum Contribution Cap',
    description: 'No participant can be billed more than their agreed budget cap in a single settlement cycle.',
    category: 'general',
    isDefault: true,
    isEnabled: false,
    priority: 9,
    parameters: { maxCapAmount: 8000 },
    exampleTrace: 'Under Rule 9 (Minimum Contribution Cap), weekly liability is capped at ₹8,000; excess is deferred with an installment schedule.',
  },
];

// ─── Rule Citation Generator ────────────────────────────────────────────────

export function generateRuleCitation(
  rule: FairnessRule,
  context: {
    memberName: string;
    deltaAmount?: number;
    reason: string;
    actionDetail?: string;
  }
): string {
  const deltaStr = context.deltaAmount !== undefined
    ? `by ₹${Math.abs(context.deltaAmount).toLocaleString('en-IN')}`
    : '';
  const direction = context.deltaAmount !== undefined
    ? (context.deltaAmount >= 0 ? 'increased' : 'decreased')
    : 'adjusted';

  return `"${context.memberName}'s balance ${direction} ${deltaStr} because ${context.reason}. Under Rule ${rule.ruleNumber} (${rule.name}), ${context.actionDetail || rule.description}"`;
}

// ─── Fairness Constitution Engine ───────────────────────────────────────────

export class FairnessEngine {
  private rules: FairnessRule[];

  constructor(customRules?: FairnessRule[]) {
    this.rules = customRules ?? [...DEFAULT_CONSTITUTION];
    this.rules.sort((a, b) => a.ruleNumber - b.ruleNumber);
  }

  getActiveRules(): FairnessRule[] {
    return this.rules.filter(r => r.isEnabled);
  }

  getAllRules(): FairnessRule[] {
    return [...this.rules];
  }

  getRule(ruleId: FairnessRuleId): FairnessRule | undefined {
    return this.rules.find(r => r.id === ruleId);
  }

  setRuleEnabled(ruleId: FairnessRuleId, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) rule.isEnabled = enabled;
  }

  updateRuleParameter(ruleId: FairnessRuleId, key: string, value: any): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.parameters = { ...(rule.parameters || {}), [key]: value };
    }
  }

  addCustomRule(rule: Omit<FairnessRule, 'ruleNumber' | 'isDefault'>): FairnessRule {
    const nextNumber = this.rules.length > 0 ? Math.max(...this.rules.map(r => r.ruleNumber)) + 1 : 1;
    const newRule: FairnessRule = {
      ...rule,
      ruleNumber: nextNumber,
      isDefault: false,
    };
    this.rules.push(newRule);
    return newRule;
  }

  /**
   * Apply fairness rules to a member-leaving scenario.
   */
  applyLeavingRules(
    leavingMemberId: string,
    leavingMemberName: string,
    reason: 'voluntary' | 'removed_by_organizer' | 'group_decision',
    committedCosts: number,
    nonRefundableLoss: number
  ): RuleCitation[] {
    const citations: RuleCitation[] = [];

    if (reason === 'voluntary') {
      const rule = this.getRule('voluntary_cancel_pays_loss');
      if (rule?.isEnabled) {
        citations.push({
          ruleNumber: rule.ruleNumber,
          ruleId: 'voluntary_cancel_pays_loss',
          ruleName: rule.name,
          explanation: generateRuleCitation(rule, {
            memberName: leavingMemberName,
            deltaAmount: nonRefundableLoss,
            reason: 'they initiated a voluntary withdrawal from pre-booked reservations',
            actionDetail: 'voluntary withdrawal costs remain assigned to the withdrawing participant until a replacement joins.',
          }),
          appliedAt: new Date().toISOString(),
          affectedMembers: [leavingMemberId],
          financialImpact: nonRefundableLoss,
        });
      }
    }

    if (reason === 'group_decision') {
      const rule = this.getRule('group_cancel_shared_equally');
      if (rule?.isEnabled) {
        citations.push({
          ruleNumber: rule.ruleNumber,
          ruleId: 'group_cancel_shared_equally',
          ruleName: rule.name,
          explanation: generateRuleCitation(rule, {
            memberName: leavingMemberName,
            reason: 'departure was a collective group decision or external force majeure',
            actionDetail: 'costs are shared equally by all affected travelers without unilateral penalty.',
          }),
          appliedAt: new Date().toISOString(),
          affectedMembers: [leavingMemberId],
          financialImpact: 0,
        });
      }
    }

    if (committedCosts > 0) {
      const rule = this.getRule('early_leaver_pays_committed');
      if (rule?.isEnabled) {
        citations.push({
          ruleNumber: rule.ruleNumber,
          ruleId: 'early_leaver_pays_committed',
          ruleName: rule.name,
          explanation: generateRuleCitation(rule, {
            memberName: leavingMemberName,
            deltaAmount: committedCosts,
            reason: 'accommodation and vehicle seats were pre-committed on their behalf',
            actionDetail: 'pre-committed expenses remain assigned to the early leaver unless taken by a replacement.',
          }),
          appliedAt: new Date().toISOString(),
          affectedMembers: [leavingMemberId],
          financialImpact: committedCosts,
        });
      }
    }

    return citations;
  }

  /**
   * Apply fairness rules to a refund scenario.
   */
  applyRefundRules(
    refundAmount: number,
    receivedByMemberId: string,
    receivedByName: string,
    originalFunders: { memberId: string; name: string; contribution: number }[]
  ): RuleCitation[] {
    const citations: RuleCitation[] = [];

    const rule = this.getRule('refund_to_funder');
    if (rule?.isEnabled) {
      citations.push({
        ruleNumber: rule.ruleNumber,
        ruleId: 'refund_to_funder',
        ruleName: rule.name,
        explanation: `Refund of ₹${refundAmount.toLocaleString('en-IN')} received by ${receivedByName}. Under Rule ${rule.ruleNumber} (${rule.name}), funds return to the people who economically funded the booking (${originalFunders.map(f => `${f.name}: ₹${f.contribution.toLocaleString('en-IN')}`).join(', ')}), not merely to the cardholder.`,
        appliedAt: new Date().toISOString(),
        affectedMembers: originalFunders.map(f => f.memberId),
        financialImpact: refundAmount,
      });
    }

    return citations;
  }

  /**
   * Apply fairness rules to a late-joiner scenario.
   */
  applyLateJoinerRules(
    newMemberId: string,
    newMemberName: string,
    joinDate: string,
    costsBeforeJoin: number
  ): RuleCitation[] {
    const citations: RuleCitation[] = [];

    const rule = this.getRule('late_joiner_no_prior_costs');
    if (rule?.isEnabled && costsBeforeJoin > 0) {
      citations.push({
        ruleNumber: rule.ruleNumber,
        ruleId: 'late_joiner_no_prior_costs',
        ruleName: rule.name,
        explanation: `${newMemberName} joined on ${new Date(joinDate).toLocaleDateString('en-IN')}. Under Rule ${rule.ruleNumber} (${rule.name}), they do not share ₹${costsBeforeJoin.toLocaleString('en-IN')} in expenses incurred before their joining.`,
        appliedAt: new Date().toISOString(),
        affectedMembers: [newMemberId],
        financialImpact: costsBeforeJoin,
      });
    }

    return citations;
  }
}

let _defaultEngine: FairnessEngine | null = null;

export function getDefaultFairnessEngine(): FairnessEngine {
  if (!_defaultEngine) {
    _defaultEngine = new FairnessEngine();
  }
  return _defaultEngine;
}
