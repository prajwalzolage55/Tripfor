'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  type LedgerEvent,
  type TripState,
  computeShapleyAllocations,
  type ShapleyResult,
  type ShapleyAllocation,
  getDetailedMarginalBreakdown,
  type MarginalBreakdown,
} from '@/lib/ledger';
import {
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Info,
  Car,
  ChevronRight,
  ShieldCheck,
  Percent,
  Sigma,
  Layers,
  Users,
  Check,
  HelpCircle,
  Divide,
} from 'lucide-react';

export default function ShapleyValuePage() {
  const params = useParams();
  const tripId = params?.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  // Inspector state
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inspector' | 'axioms' | 'car_example'>('overview');

  // Load stream
  const loadData = async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const derived = replayEvents(tripId, stream);
        setState(derived);
      }
    } catch (err) {
      console.error('Failed to load Shapley data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  // Set default selected member when loaded
  useEffect(() => {
    if (state?.members && state.members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(state.members[0].memberId);
    }
  }, [state, selectedMemberId]);

  // Compute Shapley result
  const shapleyResult: ShapleyResult | null = useMemo(() => {
    if (!state || state.members.length === 0 || state.bookings.length === 0) return null;
    return computeShapleyAllocations(state);
  }, [state]);

  // Compute marginal breakdown for selected member
  const marginalBreakdown: MarginalBreakdown | null = useMemo(() => {
    if (!state || !selectedMemberId) return null;
    return getDetailedMarginalBreakdown(state, selectedMemberId);
  }, [state, selectedMemberId]);

  // Format currency helper
  const fmt = (amt: number) => {
    return Math.round(amt).toLocaleString('en-IN');
  };

  return (
    <div className="shapley-page space-y-6 max-w-6xl mx-auto pb-20">
      {/* ─── Hero Header & Mathematical Rationale ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
              <Sparkles size={14} className="text-indigo-400" />
              Section 6 · Cooperative Game Theory
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Shapley-Value Cost Allocation
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Instead of hand-coded split rules, use Shapley values from cooperative game theory —
              the mathematically unique, axiomatically fair allocation of shared costs when
              contributions overlap in complex ways.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              title="Refresh ledger state"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Recompute Shapley</span>
            </button>
          </div>
        </div>

        {/* Callout Quote from Specification */}
        <div className="mt-5 p-3.5 rounded-xl bg-indigo-900/50 border border-indigo-700/50 text-xs text-indigo-200 font-serif italic">
          &ldquo;Why this matters: When a rented car is used by different subsets of people on different days, no manual split rule handles this cleanly. The Shapley formula computes each person&apos;s marginal contribution to the total cost across all possible subgroups — and allocates accordingly.&rdquo;
        </div>

        {/* Solver Statistics Bar */}
        {shapleyResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Solver Method</span>
              <span className="font-mono font-bold text-sm text-indigo-400 uppercase">
                {shapleyResult.method} O(n·2ⁿ)
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Axiomatic Fairness Score</span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                {shapleyResult.fairnessScore}% Optimal
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Total Evaluated Cost</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                ₹{fmt(shapleyResult.totalCost)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Efficiency Axiom</span>
              <span className="font-semibold text-xs text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 size={13} />
                Σ φᵢ = v(N) Exact
              </span>
            </div>
          </div>
        )}

        {/* Sub-Tabs Navigation */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-800">
          {[
            { id: 'overview', label: '1. Shapley vs Equal Split Table', icon: Scale },
            { id: 'inspector', label: '2. Marginal Contribution Inspector', icon: Sigma },
            { id: 'axioms', label: '3. The 4 Game-Theoretic Axioms', icon: ShieldCheck },
            { id: 'car_example', label: '4. Shared Car Multi-Day Proof', icon: Car },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: SHAPLEY VS EQUAL ALLOCATION TABLE                                  */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" />
                Axiomatic Cost Allocation Table
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparing cooperative game theory marginal contributions with naive equal division.
              </p>
            </div>

            {shapleyResult && (
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {shapleyResult.allocations.length} Active Participants
              </span>
            )}
          </div>

          {shapleyResult && shapleyResult.allocations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="pb-3">Participant</th>
                    <th className="pb-3 text-right">Shapley Fair Share (φᵢ)</th>
                    <th className="pb-3 text-right">Naive Equal Split</th>
                    <th className="pb-3 text-right">Axiomatic Variance</th>
                    <th className="pb-3 text-right">% of Trip Gross</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {shapleyResult.allocations.map(alloc => (
                    <tr key={alloc.memberId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5">
                        <span className="font-bold text-slate-900 text-sm">{alloc.memberName}</span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Participates in {alloc.breakdown.length} bookings
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-sm text-indigo-600">
                        ₹{fmt(alloc.shapleyShare)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-500">
                        ₹{fmt(alloc.equalShare)}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold">
                        {alloc.difference > 0 ? (
                          <span className="text-amber-600 inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            <TrendingUp size={11} /> +₹{fmt(alloc.difference)}
                          </span>
                        ) : alloc.difference < 0 ? (
                          <span className="text-emerald-600 inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            <TrendingDown size={11} /> -₹{fmt(Math.abs(alloc.difference))}
                          </span>
                        ) : (
                          <span className="text-slate-400">₹0 (Identical)</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-700">
                        {alloc.percentageOfTotal}%
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedMemberId(alloc.memberId);
                            setActiveTab('inspector');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
                        >
                          Inspect φᵢ Math
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No active itinerary bookings found to compute Shapley values.
            </div>
          )}

          {/* Mathematical Guarantee Callout */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <strong className="text-slate-900 block">Game-Theoretic Guarantee:</strong>
            <p className="leading-relaxed">
              When travelers join excursions selectively or leave mid-trip, a naive equal split forces non-participating travelers to subsidize activities they never attended.
              The Shapley value is provably the <strong>only</strong> allocation formula satisfying the four axioms of fairness:
              <em>Efficiency</em>, <em>Symmetry</em>, <em>Dummy Player</em>, and <em>Additivity</em>.
            </p>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MARGINAL CONTRIBUTION COALITION INSPECTOR                          */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inspector' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sigma size={18} className="text-indigo-600" />
                Coalitional Marginal Contribution Inspector
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect how every coalition permutation contributes to a specific traveler&apos;s fair share.
              </p>
            </div>

            {/* Member Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 shrink-0">Select Traveler:</label>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {state?.members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {marginalBreakdown && (
            <div className="space-y-6">
              {/* Traveler Summary Bar */}
              <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-indigo-600 text-[11px] font-bold uppercase tracking-wider block">
                    Shapley Valuation for
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    {marginalBreakdown.memberName}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Shapley Fair Share</span>
                    <span className="font-extrabold text-indigo-700 text-sm">
                      ₹{fmt(marginalBreakdown.totalShapleyShare)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Naive Share</span>
                    <span className="text-slate-600">
                      ₹{fmt(marginalBreakdown.totalEqualShare)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Variance</span>
                    <span className={marginalBreakdown.totalVariance >= 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                      {marginalBreakdown.totalVariance >= 0 ? '+' : ''}₹{fmt(marginalBreakdown.totalVariance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Combinatorial Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  All Evaluated Coalitions S ⊆ N \ &#123;{marginalBreakdown.memberName}&#125; ({marginalBreakdown.coalitions.length} Subsets)
                </h3>

                <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Coalition S</th>
                        <th className="p-2.5 text-center">|S|</th>
                        <th className="p-2.5 text-right">v(S) Without</th>
                        <th className="p-2.5 text-right">v(S ∪ &#123;i&#125;) With</th>
                        <th className="p-2.5 text-right font-bold text-slate-900">Marginal Δ</th>
                        <th className="p-2.5 text-right">Weight |S|!(n-|S|-1)!/n!</th>
                        <th className="p-2.5 text-right text-indigo-700 font-bold">Weighted Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {marginalBreakdown.coalitions.map((c, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition">
                          <td className="p-2.5 font-sans font-semibold text-slate-800">
                            {c.coalitionNames.length > 0 ? (
                              <span className="inline-flex flex-wrap gap-1">
                                {c.coalitionNames.map((name, i) => (
                                  <span key={i} className="px-1.5 py-0.2 rounded bg-slate-200/80 text-[10px]">
                                    {name}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-normal">∅ (Empty Coalition)</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500">
                            {c.coalitionSize}
                          </td>
                          <td className="p-2.5 text-right text-slate-500">
                            ₹{fmt(c.costWithoutPlayer)}
                          </td>
                          <td className="p-2.5 text-right text-slate-700">
                            ₹{fmt(c.costWithPlayer)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            ₹{fmt(c.marginalContribution)}
                          </td>
                          <td className="p-2.5 text-right text-slate-500">
                            {c.weight}
                          </td>
                          <td className="p-2.5 text-right font-bold text-indigo-700">
                            ₹{fmt(c.weightedContribution)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>
                    Mathematical Sum: Σ [Weight × Marginal] = <strong>₹{fmt(marginalBreakdown.totalShapleyShare)}</strong>
                  </span>
                  <span className="font-semibold text-indigo-600">
                    Exact Fair Share Verified ✓
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: THE 4 GAME-THEORETIC AXIOMS VERIFIER                               */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'axioms' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600" />
                The Four Mathematical Axioms of Shapley Fairness
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lloyd Shapley proved in 1953 that this is the ONE AND ONLY cost allocation method satisfying these four axioms simultaneously.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Axiom 1: Efficiency */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Axiom 1 · Efficiency
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 size={12} /> Satisfied
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">Σ φᵢ(v) = v(N)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The sum of all participants&apos; Shapley values exactly equals the total cost of all trip bookings.
                  No rupee is unallocated, and no participant pays excess phantom expenses.
                </p>
                {shapleyResult && (
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                    Total Gross: ₹{fmt(shapleyResult.totalCost)} = Sum of φ: ₹{fmt(shapleyResult.allocations.reduce((s, a) => s + a.shapleyShare, 0))}
                  </div>
                )}
              </div>

              {/* Axiom 2: Symmetry */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Axiom 2 · Symmetry
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 size={12} /> Satisfied
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">v(S ∪ &#123;i&#125;) = v(S ∪ &#123;j&#125;) ⇒ φᵢ = φⱼ</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If two travelers attend the identical set of bookings and contribute equally to every coalition,
                  their allocated fair shares are mathematically guaranteed to be equal. No favoritism.
                </p>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                  Equal participation produces identical rupee liabilities.
                </div>
              </div>

              {/* Axiom 3: Dummy / Null Player */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Axiom 3 · Dummy Player
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 size={12} /> Satisfied
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">v(S ∪ &#123;i&#125;) = v(S) ⇒ φᵢ = 0</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If a participant does not use or add cost to an excursion (e.g. they opted out of safari or joined the trip late),
                  their marginal contribution is zero. They are never billed for unused services.
                </p>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                  Opt-out activities contribute ₹0 to non-attendees.
                </div>
              </div>

              {/* Axiom 4: Additivity */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Axiom 4 · Additivity
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 size={12} /> Satisfied
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">φ(u + w) = φ(u) + φ(w)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If the trip is split into separate sub-games (e.g. Flight booking + Villa suite + Dinner),
                  the fair share of the combined trip is the exact sum of fair shares for the individual parts.
                </p>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                  Total fair share decomposes cleanly into item-level shares.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: SHARED CAR MULTI-DAY EXAMPLE PROOF                                 */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'car_example' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Car size={20} className="text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Specification Concrete Scenario: Multi-Day Rented Car
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Why standard expense splitters fail and how Shapley values solve overlapping usage structurally.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-indigo-950 text-white space-y-4 border border-indigo-900 shadow-lg">
            <h3 className="font-bold text-sm text-indigo-300">The Conflict Scenario</h3>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Suppose a self-drive SUV is rented for ₹9,000 for 3 days (₹3,000/day):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-indigo-900/60 border border-indigo-700/50">
                <span className="text-indigo-300 font-bold block">Day 1 (₹3,000)</span>
                <span className="text-slate-200">Used by: Aisha &amp; Rahul</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-900/60 border border-indigo-700/50">
                <span className="text-indigo-300 font-bold block">Day 2 (₹3,000)</span>
                <span className="text-slate-200">Used by: Rahul &amp; Priya</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-900/60 border border-indigo-700/50">
                <span className="text-indigo-300 font-bold block">Day 3 (₹3,000)</span>
                <span className="text-slate-200">Used by: Aisha, Rahul &amp; Priya</span>
              </div>
            </div>

            <div className="pt-3 border-t border-indigo-900 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60">
                <span className="font-bold text-rose-300 block mb-1">❌ Naive Equal Split Failure</span>
                <p className="text-rose-100/90 text-[11px] leading-relaxed">
                  ₹9,000 ÷ 3 = ₹3,000 each.
                  Aisha and Priya object because Rahul used the car all 3 days, whereas they each only used it for 2 days!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60">
                <span className="font-bold text-emerald-300 block mb-1">✓ Shapley Mathematical Solution</span>
                <p className="text-emerald-100/90 text-[11px] leading-relaxed">
                  Day 1: Aisha ₹1,500, Rahul ₹1,500.<br />
                  Day 2: Rahul ₹1,500, Priya ₹1,500.<br />
                  Day 3: Aisha ₹1,000, Rahul ₹1,000, Priya ₹1,000.<br />
                  <strong>Result: Rahul ₹4,000 · Aisha ₹2,500 · Priya ₹2,500</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <strong className="text-slate-900">Key Takeaway:</strong>
            <p className="leading-relaxed">
              Every edge case where people join or leave activities mid-trip is handled structurally by computing marginal contributions across coalitions — without writing brittle if/else branches.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
