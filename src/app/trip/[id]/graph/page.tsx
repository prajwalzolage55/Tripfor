'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  type LedgerEvent,
  type TripState,
  DEFAULT_CONSTITUTION,
  type FairnessRule,
  buildFinancialEventGraph,
  simulateGraphCascade,
  type FinancialGraph,
  type FinancialNode,
  type FinancialNodeType,
  type CascadeResult,
  type CascadeChangeRequest,
} from '@/lib/ledger';
import {
  Network,
  Users,
  Layers,
  Receipt,
  DollarSign,
  Gift,
  Sliders,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  Check,
  X,
  Search,
} from 'lucide-react';

export default function FinancialEventGraphPage() {
  const params = useParams();
  const tripId = params?.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  // Filter & inspection state
  const [selectedType, setSelectedType] = useState<FinancialNodeType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Cascading simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState<CascadeChangeRequest['type']>('member_withdraws');
  const [targetBookingId, setTargetBookingId] = useState<string>('');
  const [targetMemberId, setTargetMemberId] = useState<string>('');
  const [deltaPrice, setDeltaPrice] = useState<number>(2000);
  const [cascadeResult, setCascadeResult] = useState<CascadeResult | null>(null);

  // Load stream & build graph
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
      console.error('Failed to load event graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  // Set default selection when state loads
  useEffect(() => {
    if (state?.bookings && state.bookings.length > 0 && !targetBookingId) {
      setTargetBookingId(state.bookings[0].itemId);
    }
    if (state?.members && state.members.length > 0 && !targetMemberId) {
      setTargetMemberId(state.members[0].memberId);
    }
  }, [state, targetBookingId, targetMemberId]);

  // Build the 6-Node Graph from Real Trip Data
  const baseGraph: FinancialGraph | null = useMemo(() => {
    if (!state) return null;
    return buildFinancialEventGraph(state);
  }, [state]);

  // Execute cascade simulation
  const handleRunCascade = () => {
    if (!baseGraph || !state) return;

    const changeRequest: CascadeChangeRequest = {
      type: simulationType,
      targetBookingId,
      targetMemberId,
      deltaPrice,
    };

    const result = simulateGraphCascade(baseGraph, state, changeRequest);
    setCascadeResult(result);
    setIsSimulating(true);
  };

  const handleResetCascade = () => {
    setIsSimulating(false);
    setCascadeResult(null);
  };

  // Lit nodes set for visual highlighting
  const litNodeSet = useMemo(() => {
    return new Set(cascadeResult?.litNodeIds || []);
  }, [cascadeResult]);

  // Filtered nodes
  const displayNodes = useMemo(() => {
    if (!baseGraph) return [];
    return baseGraph.nodes.filter(node => {
      const matchesType = selectedType === 'all' || node.type === selectedType;
      const matchesSearch =
        !searchQuery ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.sublabel && node.sublabel.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [baseGraph, selectedType, searchQuery]);

  // Inspect connected nodes
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !baseGraph) return new Set<string>();
    const connected = new Set<string>([selectedNodeId]);
    for (const edge of baseGraph.edges) {
      if (edge.fromId === selectedNodeId) connected.add(edge.toId);
      if (edge.toId === selectedNodeId) connected.add(edge.fromId);
    }
    return connected;
  }, [selectedNodeId, baseGraph]);

  const selectedNode = useMemo(() => {
    return baseGraph?.nodes.find(n => n.id === selectedNodeId) || null;
  }, [baseGraph, selectedNodeId]);

  // Helper icons and styles for the 6 node types
  const getNodeTypeConfig = (type: FinancialNodeType) => {
    switch (type) {
      case 'people':
        return {
          icon: Users,
          label: 'People',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          cardClass: 'border-indigo-200 bg-indigo-50/30',
          dotColor: 'bg-indigo-500',
        };
      case 'commitments':
        return {
          icon: Layers,
          label: 'Commitments',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          cardClass: 'border-emerald-200 bg-emerald-50/30',
          dotColor: 'bg-emerald-500',
        };
      case 'consumption':
        return {
          icon: Receipt,
          label: 'Consumption',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          cardClass: 'border-amber-200 bg-amber-50/30',
          dotColor: 'bg-amber-500',
        };
      case 'payments':
        return {
          icon: DollarSign,
          label: 'Payments',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
          cardClass: 'border-purple-200 bg-purple-50/30',
          dotColor: 'bg-purple-500',
        };
      case 'benefits':
        return {
          icon: Gift,
          label: 'Benefits',
          badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          cardClass: 'border-cyan-200 bg-cyan-50/30',
          dotColor: 'bg-cyan-500',
        };
      case 'dependencies':
        return {
          icon: Sliders,
          label: 'Dependencies',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          cardClass: 'border-rose-200 bg-rose-50/30',
          dotColor: 'bg-rose-500',
        };
    }
  };

  return (
    <div className="financial-graph-page space-y-6 max-w-6xl mx-auto pb-20">
      {/* ─── Hero Header & Status Banner ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
              <Network size={14} className="text-emerald-400" />
              Section 4 · Financial Event Graph
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Six-Node Dependency Graph
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Behind the interface, the trip is a dependency graph across six node types:
              <strong className="text-white"> People</strong>,
              <strong className="text-white"> Commitments</strong>,
              <strong className="text-white"> Consumption</strong>,
              <strong className="text-white"> Payments</strong>,
              <strong className="text-white"> Benefits</strong>, and
              <strong className="text-white"> Dependencies</strong>.
              When one booking changes, the graph lights up to show every downstream impact on cost, assignment, and fairness.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              title="Refresh ledger state"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Sync Graph</span>
            </button>
          </div>
        </div>

        {/* 6 Node Counts Bar */}
        {baseGraph && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-6 pt-5 border-t border-slate-700/60 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-indigo-400 font-semibold block text-[11px]">1. People</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.peopleCount} Nodes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-emerald-400 font-semibold block text-[11px]">2. Commitments</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.commitmentsCount} Nodes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-amber-400 font-semibold block text-[11px]">3. Consumption</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.consumptionCount} Nodes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-purple-400 font-semibold block text-[11px]">4. Payments</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.paymentsCount} Nodes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-cyan-400 font-semibold block text-[11px]">5. Benefits</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.benefitsCount} Nodes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-rose-400 font-semibold block text-[11px]">6. Dependencies</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                {baseGraph.summary.dependenciesCount} Nodes
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── CASCADING EFFECTS SIMULATOR CONTROL BAR ("GRAPH LIGHTS UP") ─── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-amber-500 fill-amber-500" />
              Cascading Effects Simulator &amp; Ripple Trigger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a change to model how the dependency graph lights up and ripples across costs, room capacity, and fairness rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSimulating && (
              <button
                onClick={handleResetCascade}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
              >
                Clear Ripple Glow
              </button>
            )}
            <button
              onClick={handleRunCascade}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition"
            >
              <Zap size={14} />
              <span>Simulate Ripple Effect</span>
            </button>
          </div>
        </div>

        {/* Change Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Change Scenario:
            </label>
            <select
              value={simulationType}
              onChange={e => setSimulationType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="member_withdraws">Participant Leaves Booking (Capacity Shift)</option>
              <option value="cancel_booking">Cancel Entire Booking (Downstream Free)</option>
              <option value="price_increase">Vendor Tariff Surge (+₹2,000)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Target Real Booking:
            </label>
            <select
              value={targetBookingId}
              onChange={e => setTargetBookingId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {state?.bookings && state.bookings.length > 0 ? (
                state.bookings.map(b => (
                  <option key={b.itemId} value={b.itemId}>
                    {b.label} — ₹{b.cost.toLocaleString('en-IN')}
                  </option>
                ))
              ) : (
                <option value="">No bookings found</option>
              )}
            </select>
          </div>

          {simulationType === 'member_withdraws' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Withdrawing Traveler:
              </label>
              <select
                value={targetMemberId}
                onChange={e => setTargetMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {state?.members && state.members.length > 0 ? (
                  state.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.displayName}
                    </option>
                  ))
                ) : (
                  <option value="">No travelers found</option>
                )}
              </select>
            </div>
          )}

          {simulationType === 'price_increase' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tariff Delta Amount:
              </label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-slate-500">₹</span>
                <input
                  type="number"
                  step="500"
                  value={deltaPrice}
                  onChange={e => setDeltaPrice(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CASCADING IMPACT BREAKDOWN PANEL (WHEN SIMULATING) ─── */}
      {isSimulating && cascadeResult && (
        <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-4 shadow-lg animate-fadeIn">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500 text-white">
                <Zap size={18} />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Downstream Ripple Results ({cascadeResult.litNodeIds?.length || 0} Nodes Glowing)
                </h3>
                <p className="text-xs text-amber-900 font-medium">
                  The graph below has lit up to illustrate all downstream ripple effects on participants, constraints, and fairness allocations.
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Total Shifted Liability</span>
              <span className="font-mono font-black text-lg text-slate-900">
                {cascadeResult.totalGroupImpact >= 0 ? '+' : ''}₹{Math.abs(cascadeResult.totalGroupImpact).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Warnings & Broken Dependencies */}
          {cascadeResult.warnings.length > 0 && (
            <div className="space-y-1.5">
              {cascadeResult.warnings.map((w, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Applicable Fairness Citations */}
          {cascadeResult.applicableRuleCitations && cascadeResult.applicableRuleCitations.length > 0 && (
            <div className="p-4 rounded-xl bg-indigo-900 text-white space-y-2 border border-indigo-800">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                <Scale size={14} />
                <span>Fairness Constitution Citations Triggered:</span>
              </div>
              <div className="space-y-1.5">
                {cascadeResult.applicableRuleCitations.map((citation, idx) => (
                  <p key={idx} className="text-xs font-serif italic text-indigo-100 pl-3 border-l-2 border-indigo-400 leading-relaxed">
                    {citation}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Member-by-Member Impact List */}
          {cascadeResult.memberImpacts.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block mb-2.5">
                Downstream Per-Person Financial Deltas:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {cascadeResult.memberImpacts.map(impact => (
                  <div key={impact.memberId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-900">{impact.memberName}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Prev: ₹{Math.round(impact.previousShare).toLocaleString('en-IN')}</span>
                      <span>→ New: ₹{Math.round(impact.newShare).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={`font-mono font-bold text-xs ${impact.delta > 0 ? 'text-amber-600' : impact.delta < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {impact.delta > 0 ? `+₹${Math.round(impact.delta).toLocaleString('en-IN')} owes more` : impact.delta < 0 ? `-₹${Math.abs(Math.round(impact.delta)).toLocaleString('en-IN')} relieved` : 'No change'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── INTERACTIVE GRAPH VISUALIZER: 6 NODE CLUSTERS ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Controls: Type Filter & Node Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Node Type Selector Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedType === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All 6 Node Types ({baseGraph?.nodes.length || 0})
            </button>

            {(['people', 'commitments', 'consumption', 'payments', 'benefits', 'dependencies'] as FinancialNodeType[]).map(type => {
              const cfg = getNodeTypeConfig(type);
              const count = baseGraph?.nodes.filter(n => n.type === type).length || 0;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                    selectedType === type
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <cfg.icon size={13} />
                  <span>{cfg.label} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search graph nodes..."
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
            />
          </div>
        </div>

        {/* Selected Node Connections Inspector Bar */}
        {selectedNode && (
          <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-900">
                Inspecting: {selectedNode.label} ({selectedNode.type})
              </span>
              <span className="text-indigo-600 text-[11px]">
                · {connectedNodeIds.size - 1} connected dependencies highlighted
              </span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
            >
              <X size={13} /> Clear Focus
            </button>
          </div>
        )}

        {/* Node Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {displayNodes.map(node => {
            const cfg = getNodeTypeConfig(node.type);
            const isLit = litNodeSet.has(node.id);
            const isFocused = selectedNodeId === node.id;
            const isConnected = selectedNodeId && connectedNodeIds.has(node.id);

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(isFocused ? null : node.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  isLit
                    ? 'border-amber-400 bg-amber-50/90 shadow-lg ring-4 ring-amber-400/30 scale-[1.02]'
                    : isFocused
                    ? 'border-indigo-600 bg-white shadow-xl ring-2 ring-indigo-500/30'
                    : isConnected
                    ? 'border-indigo-300 bg-indigo-50/40 shadow-md'
                    : `${cfg.cardClass} hover:shadow-md hover:border-slate-300`
                }`}
              >
                {/* Lit Glow Badge */}
                {isLit && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider animate-pulse">
                      <Zap size={10} className="fill-slate-950" /> Lit Downstream
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${cfg.badgeClass}`}>
                    <cfg.icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${cfg.badgeClass}`}>
                        {cfg.label}
                      </span>
                      {node.status === 'violated' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                          Constraint Violated
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 truncate">
                      {node.label}
                    </h4>

                    {node.sublabel && (
                      <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                        {node.sublabel}
                      </p>
                    )}

                    {node.amount !== undefined && (
                      <div className="mt-2 font-mono font-extrabold text-sm text-slate-800">
                        ₹{node.amount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connected Edges Count Footnote */}
                <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>ID: {node.id.slice(0, 16)}</span>
                  <span>Click to inspect</span>
                </div>
              </div>
            );
          })}
        </div>

        {displayNodes.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            No graph nodes match your query.
          </div>
        )}
      </div>

      {/* ─── SPECIFICATION REFERENCE FOOTER ─── */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <ShieldCheck size={16} className="text-indigo-600" />
          <span>Section 4 Specification Rationale:</span>
        </div>
        <p className="leading-relaxed">
          The Financial Event Graph operates as the dynamic dependency engine for GroupTrip Ledger.
          Instead of recalculating values on a flat spreadsheet, changes propagate through the 6 node types
          (<strong className="text-slate-800">People</strong>, <strong className="text-slate-800">Commitments</strong>, <strong className="text-slate-800">Consumption</strong>, <strong className="text-slate-800">Payments</strong>, <strong className="text-slate-800">Benefits</strong>, and <strong className="text-slate-800">Dependencies</strong>),
          illuminating downstream effects and binding every financial delta to the pre-agreed Fairness Constitution.
        </p>
      </div>
    </div>
  );
}
