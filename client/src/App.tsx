import { useState, useEffect, useRef } from 'react';
import { PayPalScriptProvider, PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Code2,
  CheckCircle2,
  XCircle,
  Send,
  Split,
  Calendar,
  TrendingDown,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  tier: string;
  phase: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  description: string;
  retailerHint?: string;
}

interface ContractCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface PhasedCartGroup {
  phaseId: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  label: string;
  timingBadge: string;
  startOffsetDays: number;
  items: Product[];
  skuIds: string[];
  totalPrice: number;
  cartHash: string;
  payIn4Eligible: boolean;
  biWeeklyAmount: number;
  installments: [number, number, number, number];
}

interface PlanData {
  bundleName: string;
  rationale: string;
  items: Product[];
  totalPrice: number;
  cartHash: string;
  payIn4: {
    eligible: boolean;
    biWeeklyAmount: number;
    installments: [number, number, number, number];
    schedule: Array<{
      installment: number;
      date: string;
      isoDate: string;
      amount: number;
      label: string;
      rentBufferSafe: boolean;
    }>;
    statusMessage: string;
  };
  payMonthly: {
    eligible: boolean;
    sixMonthAmount: number;
    twelveMonthAmount: number;
  };
  phasedSplit: {
    recommended: boolean;
    reason: string;
    peakBiWeeklyDrop: number;
    phase1: PhasedCartGroup;
    phase2: PhasedCartGroup;
  };
  contracts: ContractCheck[];
  negotiationChips: Array<{ label: string; prompt: string }>;
  sourceMode: string;
}

const EXPLORE_IDEAS = [
  { label: '☕ Home Espresso Bar', goal: 'Craft Home Espresso & Matcha Bar Setup', budget: 160 },
  { label: '⛺ 2-Person Camping Kit', goal: 'Ultralight 2-Person Weekend Camping Gear Setup', budget: 125 },
  { label: '👶 Baby Nursery Essentials', goal: 'Modern Newborn Baby Nursery & Monitor Setup', budget: 180 },
  { label: '🏋️ Compact Home Gym', goal: 'Apartment Adjustable Dumbbell & Cardio Home Gym', budget: 150 },
  { label: '💻 Ergonomic WFH Desk', goal: 'Remote Software Engineer Ergonomic Desk Setup', budget: 140 },
  { label: '🎬 Pro Studio (> $1,500 Split)', goal: '4K Cinema Broadcast & Podcast Studio Rig', budget: 380, prompt: 'Select flagship pro models totaling around $1,700 to demonstrate phased split under the $1,500 Pay in 4 cap' }
];

export default function App() {
  const [paypalClientId, setPaypalClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [goal, setGoal] = useState('Craft Home Espresso & Matcha Bar Setup');
  const [budget, setBudget] = useState(160);
  const [rentDueDay, setRentDueDay] = useState<number>(1);
  const [customTradeOff, setCustomTradeOff] = useState('');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<'FULL' | 'PHASE_1' | 'PHASE_2'>('FULL');
  const [showPhasedPlanner, setShowPhasedPlanner] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [lastOrderAudit, setLastOrderAudit] = useState<any>(null);
  const [checkoutComplete, setCheckoutComplete] = useState<any>(null);

  const requestCounterRef = useRef(0);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetch(`${API_URL}/api/config`)
      .then(res => (res.ok ? res.json() : Promise.reject('Failed to load config')))
      .then(data => {
        if (data?.paypalClientId) setPaypalClientId(data.paypalClientId);
      })
      .catch(err => console.error('Config load error:', err));

    loadScenario('Craft Home Espresso & Matcha Bar Setup', 160);
  }, []);

  const loadScenario = async (selectedGoal: string, selectedBudget: number, tradeOffPrompt?: string) => {
    const reqId = ++requestCounterRef.current;
    setLoading(true);
    setErrorBanner(null);
    setCheckoutComplete(null);
    setGoal(selectedGoal);
    setBudget(selectedBudget);

    try {
      const res = await fetch(`${API_URL}/api/agent/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userGoal: selectedGoal,
          biWeeklyBudget: selectedBudget,
          tradeOffPrompt,
          rentDueDay
        })
      });

      const data = await res.json();
      if (reqId !== requestCounterRef.current) return; // Ignore stale response from rapid clicks

      if (!res.ok || data.error || !Array.isArray(data.items)) {
        throw new Error(data.error || 'Failed to generate bundle plan.');
      }

      setPlan(data);
      // Automatically open Phased Split Planner if full bundle exceeds $1,500 cap or budget cap
      if (!data.payIn4.eligible || data.phasedSplit?.recommended) {
        setShowPhasedPlanner(true);
        setCheckoutMode(!data.payIn4.eligible ? 'PHASE_1' : 'FULL');
      } else {
        setShowPhasedPlanner(false);
        setCheckoutMode('FULL');
      }
    } catch (err: any) {
      if (reqId === requestCounterRef.current) {
        setErrorBanner(err.message || 'Unable to reach SplitCart AI server.');
      }
    } finally {
      if (reqId === requestCounterRef.current) {
        setLoading(false);
      }
    }
  };

  // Returns the exact SKU IDs and server-signed HMAC cartHash for whichever mode is active
  const getActiveCheckoutPayload = () => {
    if (!plan) {
      return { skuIds: [], cartHash: '', totalPrice: 0, biWeekly: 0, label: 'Full Bundle', items: [] };
    }
    if (checkoutMode === 'PHASE_1') {
      const p1 = plan.phasedSplit.phase1;
      return {
        skuIds: p1.skuIds,
        cartHash: p1.cartHash,
        totalPrice: p1.totalPrice,
        biWeekly: p1.biWeeklyAmount,
        label: 'Phase 1: Day-1 Essentials',
        items: p1.items
      };
    }
    if (checkoutMode === 'PHASE_2') {
      const p2 = plan.phasedSplit.phase2;
      return {
        skuIds: p2.skuIds,
        cartHash: p2.cartHash,
        totalPrice: p2.totalPrice,
        biWeekly: p2.biWeeklyAmount,
        label: 'Phase 2: Expansion (+28d)',
        items: p2.items
      };
    }
    return {
      skuIds: plan.items.map(i => i.id),
      cartHash: plan.cartHash,
      totalPrice: plan.totalPrice,
      biWeekly: plan.payIn4.biWeeklyAmount,
      label: 'Full 4-Item Bundle',
      items: plan.items
    };
  };

  const checkRentCollision = (isoOrDateStr: string) => {
    const parsed = new Date(isoOrDateStr);
    if (isNaN(parsed.getTime())) return { safe: true, dayOfMonth: 1, shiftDays: 0 };
    const dayOfMonth = parsed.getDate();
    const directDiff = Math.abs(dayOfMonth - rentDueDay);
    const minDiff = Math.min(directDiff, 30 - directDiff);
    return {
      safe: minDiff > 2,
      dayOfMonth,
      shiftDays: minDiff <= 2 ? 3 - minDiff : 0
    };
  };

  const simulateOrderCreation = async () => {
    if (!plan) return;
    setErrorBanner(null);
    const activePayload = getActiveCheckoutPayload();
    try {
      const res = await fetch(`${API_URL}/api/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds: activePayload.skuIds, cartHash: activePayload.cartHash })
      });
      const order = await res.json();
      setLastOrderAudit(order);
      if (!res.ok) {
        setErrorBanner(order.error || 'Order simulation returned an error.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Network error while testing PayPal order payload.');
    }
  };

  // Pure AG Grid Community Column Definitions (Zero Enterprise warnings)
  const columnDefs: ColDef<Product>[] = [
    {
      field: 'phase',
      headerName: 'Checkout Phase',
      width: 150,
      cellRenderer: (p: any) =>
        p.value === 'PHASE_1_TODAY' ? 'Phase 1 (Today)' : 'Phase 2 (+28 Days)'
    },
    { field: 'category', headerName: 'Category', width: 140, sortable: true },
    {
      field: 'name',
      headerName: 'Discovered Product',
      flex: 2,
      sortable: true,
      filter: true
    },
    {
      field: 'price',
      headerName: 'Retail Price',
      width: 125,
      sortable: true,
      valueFormatter: p => (typeof p.value === 'number' ? `$${p.value.toFixed(2)}` : '$0.00')
    },
    {
      headerName: 'Pay in 4 (/2 Wks)',
      width: 140,
      valueGetter: p => (p.data ? Number((p.data.price / 4).toFixed(2)) : 0),
      valueFormatter: p => (typeof p.value === 'number' ? `$${p.value.toFixed(2)}/2wks` : '$0.00')
    }
  ];

  const activeCheckout = getActiveCheckoutPayload();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* BRAND HEADER */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Custom SVG Brand Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 10.2a2 2 0 002 1.6h7.8a2 2 0 001.9-1.4L21 7H7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v8m-3-3l3 3 3-3" />
                <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
                <circle cx="17.5" cy="19.5" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  SplitCart <span className="text-blue-600">AI</span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  Paycheck-Aligned Shopping
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Shop any goal A-to-Z • Dynamic Gemini product discovery • Staggered 0% APR PayPal Pay in 4 planner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAuditDrawer(!showAuditDrawer)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 transition"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Security & API Audit</span>
              {showAuditDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* CONSUMER RESEARCH & VALUE PROPOSITION STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-sky-300 uppercase">Why Bi-Weekly Budgeting?</p>
              <p className="text-xs text-slate-200 mt-0.5">
                <strong>84.7% of Americans</strong> actively budget and <strong>48% live paycheck-to-paycheck</strong> (Debt.com), yet standard carts only show total price.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-300 uppercase">Why Stagger Into 2 Phases?</p>
              <p className="text-xs text-slate-200 mt-0.5">
                Buying Phase 1 essentials today and queuing Phase 2 upgrades for <strong>Day +28</strong> cuts your per-paycheck hit by <strong>~45%</strong> so installments never stack.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300 uppercase">Prevent Rent-Day Overdrafts</p>
              <p className="text-xs text-slate-200 mt-0.5">
                <strong>18% of liquidity-constrained BNPL users</strong> incur bank overdraft fees when auto-debits collide with rent day (Federal Reserve SHED Report).
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH ANY GOAL A-TO-Z + PAYCHECK & RENT CONTROLS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                What do you want to build or shop for? (Anything A to Z)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={goal}
                  placeholder="e.g., Home Espresso Bar, Newborn Nursery, 2-Person Camping Gear, Gaming PC..."
                  onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) loadScenario(goal, budget);
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Target Per-Paycheck Cap
              </label>
              <div className="relative">
                <span className="text-xs font-bold text-slate-400 absolute left-3 top-2.5">$</span>
                <input
                  type="number"
                  min={15}
                  max={2000}
                  value={budget}
                  onChange={e => setBudget(Math.max(15, Number(e.target.value) || 0))}
                  className="w-full pl-7 pr-14 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <span className="text-[11px] text-slate-500 absolute right-3 top-2.5">/2 wks</span>
              </div>
            </div>

            <div className="w-48">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Rent / Major Bill Day
              </label>
              <select
                value={rentDueDay}
                onChange={e => setRentDueDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-600 bg-white"
              >
                <option value={1}>1st of Month (Standard)</option>
                <option value={10}>10th of Month</option>
                <option value={15}>15th of Month (Mid-Month)</option>
                <option value={24}>24th of Month</option>
              </select>
            </div>

            <button
              onClick={() => loadScenario(goal, budget)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Discovering...' : 'Discover & Plan'}
            </button>
          </div>

          {/* Lightweight Category Inspiration Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Try any category:</span>
            {EXPLORE_IDEAS.map((idea, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => loadScenario(idea.goal, idea.budget, idea.prompt)}
                className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 px-3 py-1 rounded-full border border-slate-200 transition disabled:opacity-50 cursor-pointer"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

        {/* ERROR BANNER */}
        {errorBanner && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-red-700 font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: Bundle Table, Trade-Off Negotiator & Phased Cash-Flow Schedule */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              {plan && (
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900">{plan.bundleName}</h2>
                      <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                        {plan.sourceMode === 'gemini-live' ? '✨ Live Gemini Discovery' : '⚡ Instant Budget Match'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{plan.rationale}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">${plan.totalPrice.toFixed(2)}</span>
                    {plan.payIn4.eligible ? (
                      <p className="text-xs font-bold text-emerald-600">
                        Full Bundle: 4x ${plan.payIn4.biWeeklyAmount.toFixed(2)}/2wks (0% APR)
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-amber-600">
                        Over $1,500 Single-Cart Cap • Phased Split Unlocked Below
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* AG Grid Community Table */}
              <div className="w-full h-64 min-h-[250px] border border-slate-200 rounded-lg overflow-hidden bg-white">
                {loading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-sm text-slate-600 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="font-semibold">Gemini is discovering products & computing your PayPal Pay in 4 schedule...</span>
                  </div>
                ) : (
                  <div className="ag-theme-alpine w-full h-full">
                    <AgGridReact rowData={plan?.items || []} columnDefs={columnDefs} />
                  </div>
                )}
              </div>

              {/* AI Trade-Off Negotiator */}
              {plan && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Customize or Swap Items With Gemini:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plan.negotiationChips.map((chip, idx) => (
                      <button
                        key={idx}
                        disabled={loading}
                        onClick={() => loadScenario(goal, budget, chip.prompt)}
                        className="text-xs bg-white hover:bg-blue-50 text-slate-800 border border-blue-200 font-medium px-3 py-1.5 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Ask for any adjustment (e.g., 'Swap to a Breville Dual Boiler', 'Keep total under $450')..."
                      value={customTradeOff}
                      onChange={e => setCustomTradeOff(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customTradeOff.trim() && !loading) {
                          loadScenario(goal, budget, customTradeOff);
                          setCustomTradeOff('');
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      disabled={loading || !customTradeOff.trim()}
                      onClick={() => {
                        if (customTradeOff.trim()) {
                          loadScenario(goal, budget, customTradeOff);
                          setCustomTradeOff('');
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Update Bundle
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PAYCHECK-STAGGERED PHASED CHECKOUT PLANNER & 6-WEEK TIMELINE */}
            {plan && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      Paycheck-Aligned Cash-Flow Schedule
                    </h3>
                    <p className="text-xs text-slate-500">
                      Compare buying everything today vs. staggering Phase 1 Essentials today and Phase 2 Upgrades on Day +28.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPhasedPlanner(!showPhasedPlanner)}
                    className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Split className="w-3.5 h-3.5" />
                    {showPhasedPlanner ? 'Hide Phased Split Planner' : 'Stagger Into 2 Paycheck Phases (-$' + plan.phasedSplit.peakBiWeeklyDrop.toFixed(2) + '/2wks)'}
                  </button>
                </div>

                {/* 4-Installment Schedule Cards for Currently Selected Checkout Mode */}
                {plan.payIn4.eligible || checkoutMode !== 'FULL' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {plan.payIn4.schedule.map((slot, idx) => {
                      const collision = checkRentCollision(slot.isoDate || slot.date);
                      const displayAmount =
                        checkoutMode === 'PHASE_1'
                          ? plan.phasedSplit.phase1.installments[idx]
                          : checkoutMode === 'PHASE_2'
                          ? plan.phasedSplit.phase2.installments[idx]
                          : slot.amount;
                      return (
                        <div
                          key={slot.installment}
                          className={`p-3 rounded-lg border ${
                            collision.safe ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/90 border-amber-400'
                          }`}
                        >
                          <span className="text-[11px] font-semibold text-slate-500 block">{slot.label}</span>
                          <span className="text-lg font-extrabold text-slate-900 mt-1 block">
                            ${displayAmount.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500 block">{slot.date}</span>
                          {collision.safe ? (
                            <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
                              ✓ 0% APR • Clears Bill Day ({rentDueDay})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-800 font-bold mt-1 block">
                              ⚠️ Near Bill Day ({rentDueDay}) • Delay {collision.shiftDays}d
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Phased Paycheck-Staggered Split Cards */}
                {(showPhasedPlanner || !plan.payIn4.eligible) && (
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Split className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Phased Paycheck-Staggered Checkout (Why Pay Everything Day 1?)
                        </h4>
                      </div>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                        Drops Immediate Hit to ${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{plan.phasedSplit.reason}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* PHASE 1 CARD */}
                      <div
                        className={`p-4 rounded-lg border transition ${
                          checkoutMode === 'PHASE_1'
                            ? 'bg-white border-blue-600 ring-2 ring-blue-600/20'
                            : 'bg-white/90 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {plan.phasedSplit.phase1.label}
                            </span>
                            <span className="text-[11px] text-blue-600 font-semibold block">
                              {plan.phasedSplit.phase1.timingBadge}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-bold">
                              ✓ 4x ${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks (0% APR)
                            </span>
                          </div>
                          <span className="text-base font-black text-slate-900">
                            ${plan.phasedSplit.phase1.totalPrice.toFixed(2)}
                          </span>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1 mb-3">
                          {plan.phasedSplit.phase1.items.map(item => (
                            <li key={item.id} className="flex justify-between">
                              <span className="truncate pr-2">• {item.name}</span>
                              <span className="font-mono shrink-0">${item.price.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => {
                            setCheckoutMode('PHASE_1');
                            setCheckoutComplete(null);
                          }}
                          className={`w-full py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                            checkoutMode === 'PHASE_1'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {checkoutMode === 'PHASE_1'
                            ? '✓ Loaded in PayPal Checkout →'
                            : 'Checkout Phase 1 Essentials Today'}
                        </button>
                      </div>

                      {/* PHASE 2 CARD */}
                      <div
                        className={`p-4 rounded-lg border transition ${
                          checkoutMode === 'PHASE_2'
                            ? 'bg-white border-blue-600 ring-2 ring-blue-600/20'
                            : 'bg-white/90 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {plan.phasedSplit.phase2.label}
                            </span>
                            <span className="text-[11px] text-amber-700 font-semibold block">
                              {plan.phasedSplit.phase2.timingBadge}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-bold">
                              ✓ 4x ${plan.phasedSplit.phase2.biWeeklyAmount.toFixed(2)}/2wks (0% APR)
                            </span>
                          </div>
                          <span className="text-base font-black text-slate-900">
                            ${plan.phasedSplit.phase2.totalPrice.toFixed(2)}
                          </span>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1 mb-3">
                          {plan.phasedSplit.phase2.items.map(item => (
                            <li key={item.id} className="flex justify-between">
                              <span className="truncate pr-2">• {item.name}</span>
                              <span className="font-mono shrink-0">${item.price.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => {
                            setCheckoutMode('PHASE_2');
                            setCheckoutComplete(null);
                          }}
                          className={`w-full py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                            checkoutMode === 'PHASE_2'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {checkoutMode === 'PHASE_2'
                            ? '✓ Loaded in PayPal Checkout →'
                            : 'Preview / Checkout Phase 2 Cart'}
                        </button>
                      </div>
                    </div>

                    {checkoutMode !== 'FULL' && plan.payIn4.eligible && (
                      <div className="text-right">
                        <button
                          onClick={() => {
                            setCheckoutMode('FULL');
                            setCheckoutComplete(null);
                          }}
                          className="text-xs text-blue-700 font-semibold underline cursor-pointer"
                        >
                          Switch back to Full Bundle (${plan.totalPrice.toFixed(2)})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live PayPal Pay Later Checkout */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">PayPal Pay Later Checkout</h3>
                  <p className="text-xs text-slate-500">{activeCheckout.label}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</span>
                  <span className="block text-[11px] font-bold text-emerald-600">
                    4x ${activeCheckout.biWeekly.toFixed(2)}/2wks
                  </span>
                </div>
              </div>

              {paypalClientId && plan ? (
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId,
                    components: 'buttons,messages',
                    enableFunding: 'paylater',
                    currency: 'USD'
                  }}
                >
                  <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                    <PayPalMessages
                      amount={activeCheckout.totalPrice}
                      style={{ layout: 'text', logo: { type: 'primary' } }}
                    />
                  </div>

                  {checkoutComplete ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-sm text-emerald-900">Payment Successful</h4>
                      <p className="text-xs text-slate-600">
                        Your PayPal Pay Later order of{' '}
                        <strong className="text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</strong> (
                        {activeCheckout.label}) has been authorized and captured.
                      </p>
                      <p className="text-[11px] font-mono text-slate-600 bg-white py-1 px-2.5 rounded border border-emerald-200 inline-block">
                        Capture ID: {checkoutComplete.captureId || checkoutComplete.id}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <PayPalButtons
                        fundingSource="paylater"
                        style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
                        forceReRender={[activeCheckout.totalPrice, activeCheckout.cartHash, checkoutMode]}
                        createOrder={async () => {
                          setErrorBanner(null);
                          const payload = getActiveCheckoutPayload();
                          const res = await fetch(`${API_URL}/api/paypal/create-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ skuIds: payload.skuIds, cartHash: payload.cartHash })
                          });
                          const order = await res.json();
                          setLastOrderAudit(order);
                          if (!res.ok || !order.id) {
                            setErrorBanner(order.error || 'Could not create PayPal order.');
                            throw new Error(order.error || 'Order creation failed');
                          }
                          return order.id;
                        }}
                        onApprove={async (data: any) => {
                          setErrorBanner(null);
                          const res = await fetch(`${API_URL}/api/paypal/capture-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID })
                          });
                          const capture = await res.json();
                          if (!res.ok || capture.error) {
                            setErrorBanner(capture.error || 'Payment capture was declined or failed.');
                            return;
                          }
                          setCheckoutComplete(capture);
                        }}
                        onError={(err: any) => {
                          console.error('PayPal button error:', err);
                        }}
                      />
                      <PayPalButtons
                        fundingSource="paypal"
                        style={{ layout: 'vertical', shape: 'rect' }}
                        forceReRender={[activeCheckout.totalPrice, activeCheckout.cartHash, checkoutMode]}
                        createOrder={async () => {
                          setErrorBanner(null);
                          const payload = getActiveCheckoutPayload();
                          const res = await fetch(`${API_URL}/api/paypal/create-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ skuIds: payload.skuIds, cartHash: payload.cartHash })
                          });
                          const order = await res.json();
                          setLastOrderAudit(order);
                          if (!res.ok || !order.id) {
                            setErrorBanner(order.error || 'Could not create PayPal order.');
                            throw new Error(order.error || 'Order creation failed');
                          }
                          return order.id;
                        }}
                        onApprove={async (data: any) => {
                          setErrorBanner(null);
                          const res = await fetch(`${API_URL}/api/paypal/capture-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID })
                          });
                          const capture = await res.json();
                          if (!res.ok || capture.error) {
                            setErrorBanner(capture.error || 'Payment capture was declined or failed.');
                            return;
                          }
                          setCheckoutComplete(capture);
                        }}
                      />
                    </div>
                  )}
                </PayPalScriptProvider>
              ) : (
                <p className="text-xs text-slate-400">Loading PayPal Sandbox SDK...</p>
              )}
            </div>

            {/* COLLAPSIBLE SECURITY & API AUDIT DRAWER */}
            {showAuditDrawer && plan && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Server Security & Guardrail Contracts
                  </h4>
                  <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    {plan.contracts.filter(c => c.passed).length}/{plan.contracts.length} Verified
                  </span>
                </div>
                <div className="space-y-2">
                  {plan.contracts.map(c => (
                    <div key={c.code} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>{c.label}</span>
                        {c.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono break-all">{c.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={simulateOrderCreation}
                    className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Code2 className="w-4 h-4 text-blue-600" />
                    Inspect Live PayPal Orders v2 Payload ({activeCheckout.label})
                  </button>
                  {lastOrderAudit && (
                    <pre className="mt-2 p-2.5 bg-slate-900 text-emerald-400 text-[10px] rounded-lg overflow-x-auto max-h-44 font-mono">
                      {JSON.stringify(lastOrderAudit, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}