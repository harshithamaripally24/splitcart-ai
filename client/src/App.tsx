import { useState, useEffect, useRef } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Send,
  Split,
  Calendar,
  TrendingDown,
  Search,
  ShoppingBag,
  ShieldCheck,
  Check,
  Trash2,
  Clock
} from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import type { PlanData, Product } from './types/bundle.types';
import { API_URL, fetchClientConfig, requestBundlePlan } from './services/splitcart-api.client';

const EXPLORE_IDEAS = [
  { label: '☕ Home Espresso Bar', goal: 'Craft Home Espresso & Matcha Bar Setup', budget: 160 },
  { label: '⛺ 2-Person Camping Kit', goal: 'Ultralight 2-Person Weekend Camping Gear Setup', budget: 140 },
  { label: '👶 Baby Nursery', goal: 'Modern Newborn Baby Nursery & Monitor Setup', budget: 180 },
  { label: '🏋️ Compact Home Gym', goal: 'Apartment Adjustable Dumbbell & Cardio Home Gym', budget: 150 },
  { label: '💻 Home Office Desk', goal: 'Remote Software Engineer Ergonomic Desk Setup', budget: 145 },
  {
    label: '🎥 Pro Video Studio ($1,680+)',
    goal: '4K Cinema Camera & Podcast Studio Kit',
    budget: 420,
    prompt: 'Select flagship pro models totaling around $1,700'
  }
];

function computeLocalInstallments(totalCents: number): [number, number, number, number] {
  if (totalCents <= 0) return [0, 0, 0, 0];
  const baseCents = Math.floor(totalCents / 4);
  const remainder = totalCents - baseCents * 4;
  return [
    Number(((baseCents + remainder) / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2))
  ];
}

function isDateSafeFromBillDay(dateObj: Date, billDay: number): boolean {
  const dayOfMonth = dateObj.getDate();
  const directDiff = Math.abs(dayOfMonth - billDay);
  const minDiff = Math.min(directDiff, 30 - directDiff);
  return minDiff > 2;
}

function computeBestDayToBuy(billDay: number): {
  buyTodaySafe: boolean;
  recommendedDateLabel: string;
  daysToWait: number;
  scheduleFromBestDay: { label: string; dateLabel: string }[];
} {
  const offsets = [0, 14, 28, 42];
  const labels = ['Payment 1', 'Payment 2 (+14d)', 'Payment 3 (+28d)', 'Payment 4 (+42d)'];
  const today = new Date();

  for (let wait = 0; wait <= 14; wait++) {
    const candidateStart = new Date(today);
    candidateStart.setDate(today.getDate() + wait);

    const allFourClear = offsets.every(offset => {
      const pullDate = new Date(candidateStart);
      pullDate.setDate(candidateStart.getDate() + offset);
      return isDateSafeFromBillDay(pullDate, billDay);
    });

    if (allFourClear) {
      const formatted = candidateStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      return {
        buyTodaySafe: wait === 0,
        recommendedDateLabel: wait === 0 ? `Today (${formatted})` : formatted,
        daysToWait: wait,
        scheduleFromBestDay: offsets.map((off, idx) => {
          const d = new Date(candidateStart);
          d.setDate(candidateStart.getDate() + off);
          return {
            label: labels[idx],
            dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          };
        })
      };
    }
  }

  return {
    buyTodaySafe: true,
    recommendedDateLabel: 'Today',
    daysToWait: 0,
    scheduleFromBestDay: []
  };
}

function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function App() {
  const [paypalClientId, setPaypalClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [goal, setGoal] = useState('Craft Home Espresso & Matcha Bar Setup');
  const [budget, setBudget] = useState(160);
  const [budgetInput, setBudgetInput] = useState('160');
  const [rentDueDay, setRentDueDay] = useState<number>(1);
  const [customTradeOff, setCustomTradeOff] = useState('');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [customCartHash, setCustomCartHash] = useState<string>('');
  const [checkoutComplete, setCheckoutComplete] = useState<any>(null);

  const requestCounterRef = useRef(0);

  useEffect(() => {
    fetchClientConfig()
      .then(data => {
        if (data?.paypalClientId) setPaypalClientId(data.paypalClientId);
      })
      .catch(err => console.error('Config load error:', err));

    loadScenario('Craft Home Espresso & Matcha Bar Setup', 160);
  }, []);

  const syncSelectionHashWithServer = async (
    skuIds: string[],
    currentPlan: PlanData,
    selectedItems: Product[]
  ): Promise<string> => {
    if (skuIds.length === 0) {
      setCustomCartHash('');
      return '';
    }
    if (skuIds.length === currentPlan.items.length) {
      setCustomCartHash(currentPlan.cartHash);
      return currentPlan.cartHash;
    }
    const p1Ids = currentPlan.phasedSplit.phase1.skuIds;
    if (skuIds.length === p1Ids.length && skuIds.every(id => p1Ids.includes(id))) {
      setCustomCartHash(currentPlan.phasedSplit.phase1.cartHash);
      return currentPlan.phasedSplit.phase1.cartHash;
    }
    const p2Ids = currentPlan.phasedSplit.phase2.skuIds;
    if (skuIds.length === p2Ids.length && skuIds.every(id => p2Ids.includes(id))) {
      setCustomCartHash(currentPlan.phasedSplit.phase2.cartHash);
      return currentPlan.phasedSplit.phase2.cartHash;
    }

    try {
      const res = await fetch(`${API_URL}/api/agent/sign-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds, fallbackItems: selectedItems })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.cartHash) {
          setCustomCartHash(data.cartHash);
          return data.cartHash;
        }
      }
    } catch {
      // Silent background sync
    }
    return '';
  };

  const loadScenario = async (selectedGoal: string, selectedBudget: number, tradeOffPrompt?: string) => {
    const reqId = ++requestCounterRef.current;
    const cleanCap = Math.max(15, Math.min(2000, Math.round(Number(selectedBudget) || 160)));
    setLoading(true);
    setErrorBanner(null);
    setCheckoutComplete(null);
    setGoal(selectedGoal);
    setBudget(cleanCap);
    setBudgetInput(String(cleanCap));

    try {
      const data = await requestBundlePlan({
        userGoal: selectedGoal,
        biWeeklyBudget: cleanCap,
        tradeOffPrompt,
        rentDueDay
      });

      if (reqId !== requestCounterRef.current) return;

      setPlan(data);
      if (!data.payIn4.eligible) {
        setSelectedSkuIds(data.phasedSplit.phase1.skuIds);
        setCustomCartHash(data.phasedSplit.phase1.cartHash);
      } else {
        const allIds = data.items.map(i => i.id);
        setSelectedSkuIds(allIds);
        setCustomCartHash(data.cartHash);
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

  const commitBudgetInput = (): number => {
    const parsed = Number(budgetInput);
    const clamped = isNaN(parsed) || parsed < 15 ? 15 : Math.min(2000, Math.round(parsed));
    setBudget(clamped);
    setBudgetInput(String(clamped));
    return clamped;
  };

  const handleToggleItem = (clickedId: string) => {
    if (!plan) return;
    setErrorBanner(null);
    setCheckoutComplete(null);

    const updatedSet = new Set(selectedSkuIds);
    if (updatedSet.has(clickedId)) {
      updatedSet.delete(clickedId);
    } else {
      updatedSet.add(clickedId);
    }

    const activeItems = plan.items.filter(i => updatedSet.has(i.id));
    const orderedIds = activeItems.map(i => i.id);

    setSelectedSkuIds(orderedIds);
    syncSelectionHashWithServer(orderedIds, plan, activeItems);
  };

  const selectPresetGroup = (mode: 'FULL' | 'PHASE_1' | 'PHASE_2' | 'EMPTY') => {
    if (!plan) return;
    setErrorBanner(null);
    setCheckoutComplete(null);
    if (mode === 'EMPTY') {
      setSelectedSkuIds([]);
      setCustomCartHash('');
      return;
    }
    if (mode === 'FULL') {
      const allIds = plan.items.map(i => i.id);
      setSelectedSkuIds(allIds);
      setCustomCartHash(plan.cartHash);
    } else if (mode === 'PHASE_1') {
      setSelectedSkuIds(plan.phasedSplit.phase1.skuIds);
      setCustomCartHash(plan.phasedSplit.phase1.cartHash);
    } else {
      setSelectedSkuIds(plan.phasedSplit.phase2.skuIds);
      setCustomCartHash(plan.phasedSplit.phase2.cartHash);
    }
  };

  const getActiveCheckoutPayload = () => {
    if (!plan) {
      return {
        skuIds: [] as string[],
        cartHash: '',
        totalPrice: 0,
        biWeekly: 0,
        installments: [0, 0, 0, 0] as [number, number, number, number],
        label: 'Empty Bag',
        mode: 'EMPTY' as 'FULL' | 'PHASE_1' | 'PHASE_2' | 'CUSTOM' | 'EMPTY',
        items: [] as Product[]
      };
    }

    const activeItems = plan.items.filter(i => selectedSkuIds.includes(i.id));
    if (activeItems.length === 0) {
      return {
        skuIds: [] as string[],
        cartHash: '',
        totalPrice: 0,
        biWeekly: 0,
        installments: [0, 0, 0, 0] as [number, number, number, number],
        label: 'No Items Selected',
        mode: 'EMPTY' as 'FULL' | 'PHASE_1' | 'PHASE_2' | 'CUSTOM' | 'EMPTY',
        items: [] as Product[]
      };
    }

    const totalCents = activeItems.reduce((sum, i) => sum + Math.round(i.price * 100), 0);
    const totalPrice = Number((totalCents / 100).toFixed(2));
    const installments = computeLocalInstallments(totalCents);

    const p1Ids = plan.phasedSplit.phase1.skuIds;
    const p2Ids = plan.phasedSplit.phase2.skuIds;

    let mode: 'FULL' | 'PHASE_1' | 'PHASE_2' | 'CUSTOM' = 'CUSTOM';
    let label = 'Your Selected Items';
    let resolvedHash = customCartHash;

    if (activeItems.length === plan.items.length) {
      mode = 'FULL';
      label = `All ${plan.items.length} Curated Items`;
      resolvedHash = plan.cartHash;
    } else if (activeItems.length === p1Ids.length && activeItems.every(i => p1Ids.includes(i.id))) {
      mode = 'PHASE_1';
      label = 'Paycheck 1: Essentials (Buy Today)';
      resolvedHash = plan.phasedSplit.phase1.cartHash;
    } else if (activeItems.length === p2Ids.length && activeItems.every(i => p2Ids.includes(i.id))) {
      mode = 'PHASE_2';
      label = 'Upgrades & Accessories';
      resolvedHash = plan.phasedSplit.phase2.cartHash;
    }

    return {
      skuIds: activeItems.map(i => i.id),
      cartHash: resolvedHash,
      totalPrice,
      biWeekly: installments[0],
      installments,
      label,
      mode,
      items: activeItems
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

  const activeCheckout = getActiveCheckoutPayload();
  const activeSkuSet = new Set(activeCheckout.skuIds);
  const biWeeklySavedVsFull =
    plan && activeCheckout.items.length > 0 && activeCheckout.items.length < plan.items.length
      ? Number((plan.payIn4.biWeeklyAmount - activeCheckout.biWeekly).toFixed(2))
      : 0;
  const bestBuyTiming = computeBestDayToBuy(rentDueDay);
  const isWithinCap = activeCheckout.biWeekly <= budget;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-sky-300 border border-sky-400/30 px-2.5 py-0.5 rounded-full mb-2">
                <Sparkles className="w-3 h-3" /> Smart Bi-Weekly Cash-Flow Planner
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Plan What to Buy and When, So Payments Never Collide With Your Bills
              </h1>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Essentials First • Best Purchase Date Solver</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-4 rounded-xl text-slate-900 shadow-sm">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                What are you shopping for? (Single Item or Project)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={goal}
                  placeholder="e.g., Espresso Machine, Sony Camera, Baby Nursery..."
                  onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) {
                      const clean = commitBudgetInput();
                      loadScenario(goal, clean);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                2-Week Paycheck Comfort Cap
              </label>
              <div className="relative">
                <span className="text-xs font-bold text-slate-400 absolute left-3 top-2.5">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetInput}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setBudgetInput(raw);
                    if (raw !== '' && Number(raw) >= 15) {
                      setBudget(Math.min(2000, Number(raw)));
                    }
                  }}
                  onBlur={() => commitBudgetInput()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) {
                      const clean = commitBudgetInput();
                      loadScenario(goal, clean);
                    }
                  }}
                  className="w-full pl-7 pr-16 py-2 border border-slate-300 rounded-lg text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-600 [appearance:textfield]"
                />
                <span className="text-[11px] font-semibold text-blue-600 absolute right-3 top-2.5">/ 2 wks</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Rent / Bill Day
              </label>
              <select
                value={rentDueDay}
                onChange={e => setRentDueDay(Number(e.target.value))}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50"
              >
                <option value={1}>1st of Month</option>
                <option value={10}>10th of Month</option>
                <option value={15}>15th of Month</option>
                <option value={24}>24th of Month</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                onClick={() => {
                  const clean = commitBudgetInput();
                  loadScenario(goal, clean);
                }}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? 'Planning...' : 'Plan Cart'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">Quick Try:</span>
            {EXPLORE_IDEAS.map((idea, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => loadScenario(idea.goal, idea.budget, idea.prompt)}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full border border-white/15 transition disabled:opacity-50 cursor-pointer font-medium"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

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
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              {plan && (
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-100">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {activeCheckout.items.length === 1
                          ? 'Single Item Selected'
                          : activeCheckout.items.length === 0
                          ? 'Bag Empty — Select Any Item Below'
                          : 'Interactive Shopping Checklist'}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        ✓ Click any card to check or uncheck
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900">{plan.bundleName}</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      {plan.rationale
                        .replace(/via 0% APR PayPal Pay in 4/gi, 'across 4 bi-weekly payments')
                        .replace(/PayPal Pay in 4|PayPal|Pay in 4/gi, '4 bi-weekly payments')}
                    </p>
                  </div>
                  <div className="text-right bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block">Selected Bag Total</span>
                    <span className="text-2xl font-black text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</span>
                    {activeCheckout.items.length > 0 ? (
                      <>
                        <p className="text-xs font-bold text-emerald-600">
                          4x ${activeCheckout.biWeekly.toFixed(2)} / 2 wks
                        </p>
                        <p
                          className={`text-[11px] font-bold mt-0.5 ${
                            isWithinCap ? 'text-slate-600' : 'text-amber-700'
                          }`}
                        >
                          ${activeCheckout.biWeekly.toFixed(2)} of your ${budget}/2wks cap used
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-slate-400">$0.00 of ${budget}/2wks cap used</p>
                    )}
                    {biWeeklySavedVsFull > 0 && (
                      <span className="inline-block mt-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Lowering bi-weekly payment by ${biWeeklySavedVsFull.toFixed(2)}/2wks
                      </span>
                    )}
                  </div>
                </div>
              )}

              {plan && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-xl">
                  <button
                    onClick={() => selectPresetGroup('FULL')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeCheckout.mode === 'FULL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All 4 Items (${plan.payIn4.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                  <button
                    onClick={() => selectPresetGroup('PHASE_1')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeCheckout.mode === 'PHASE_1'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    Essentials First (${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                  <button
                    onClick={() => selectPresetGroup('PHASE_2')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeCheckout.mode === 'PHASE_2'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    Extras Only (${plan.phasedSplit.phase2.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                  {activeCheckout.items.length > 0 && (
                    <button
                      onClick={() => selectPresetGroup('EMPTY')}
                      title="Remove all items from bag"
                      className="py-2 px-3 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-white/60 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear Bag
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="w-full py-16 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 gap-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="font-bold text-slate-800">Building checklist & calculating payment dates...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(plan?.items || []).map(item => {
                    const isPhase1 = item.phase === 'PHASE_1_TODAY';
                    const isIncludedInActiveCart = activeSkuSet.has(item.id);
                    const itemBiWeekly = (item.price / 4).toFixed(2);

                    let statusBadgeText = 'Not Selected';
                    let statusBadgeClass = 'bg-slate-200 text-slate-600';

                    if (isIncludedInActiveCart) {
                      statusBadgeText = isPhase1 ? 'Essential • In Your Bag' : 'Extra • In Your Bag';
                      statusBadgeClass = 'bg-emerald-100 text-emerald-800';
                    } else if (activeCheckout.items.length > 0) {
                      statusBadgeText = isPhase1 ? 'Essential • Unchecked' : 'Can Wait • Next Paycheck (+28d)';
                      statusBadgeClass = 'bg-amber-100 text-amber-800';
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between select-none ${
                          isIncludedInActiveCart
                            ? 'bg-white border-blue-600 shadow-sm'
                            : 'bg-slate-50/70 border-slate-200 opacity-60 hover:opacity-95'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${statusBadgeClass}`}
                            >
                              {statusBadgeText}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] font-extrabold transition ${
                                isIncludedInActiveCart
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-slate-300 bg-white text-slate-600'
                              }`}
                            >
                              {isIncludedInActiveCart ? (
                                <>
                                  <Check className="w-3 h-3" /> In Bag
                                </>
                              ) : (
                                '+ Add to Bag'
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            <span>{item.brand || 'Demo Catalog'}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                          </div>

                          <h3 className="text-sm font-extrabold text-slate-900 mt-0.5 leading-snug">
                            {item.name}
                          </h3>

                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-slate-400 font-medium">Est. </span>
                            <span className="text-sm font-bold text-slate-700">${item.price.toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-blue-600">${itemBiWeekly}</span>
                            <span className="text-[11px] font-semibold text-slate-500"> / 2 wks</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {plan && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Customize or Swap Any Item with AI:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {plan.negotiationChips.map((chip, idx) => (
                        <button
                          key={idx}
                          disabled={loading}
                          onClick={() => loadScenario(goal, budget, chip.prompt)}
                          className="text-xs bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold px-3 py-1 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask AI to swap any item or adjust tier (e.g., 'Cheaper grinder', 'Include a crib mattress')..."
                      value={customTradeOff}
                      onChange={e => setCustomTradeOff(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customTradeOff.trim() && !loading) {
                          loadScenario(goal, budget, customTradeOff);
                          setCustomTradeOff('');
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                    />
                    <button
                      disabled={loading || !customTradeOff.trim()}
                      onClick={() => {
                        if (customTradeOff.trim()) {
                          loadScenario(goal, budget, customTradeOff);
                          setCustomTradeOff('');
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Update
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PAYMENT SCHEDULE & BEST DAY TO BUY SOLVER */}
            {plan && activeCheckout.items.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      Your 4-Payment Timeline ({activeCheckout.label})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Checked against your {formatOrdinal(rentDueDay)} of the month bill / rent due date.
                    </p>
                  </div>

                  {activeCheckout.items.length >= 2 && activeCheckout.mode !== 'PHASE_1' && (
                    <button
                      onClick={() => selectPresetGroup('PHASE_1')}
                      className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Split className="w-3.5 h-3.5" />
                      Buy Essentials First (${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks)
                    </button>
                  )}
                </div>

                {/* BEST DAY TO BUY RECOMMENDATION BANNER */}
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    bestBuyTiming.buyTodaySafe
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <Clock
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      bestBuyTiming.buyTodaySafe ? 'text-emerald-600' : 'text-amber-700'
                    }`}
                  />
                  <div>
                    {bestBuyTiming.buyTodaySafe ? (
                      <p className="font-bold">
                        Best day to buy: <span className="underline">{bestBuyTiming.recommendedDateLabel}</span> — none
                        of the 4 payments (Day 0, +14d, +28d, +42d) land within 2 days of the{' '}
                        {formatOrdinal(rentDueDay)}.
                      </p>
                    ) : (
                      <p className="font-bold">
                        Best day to buy: Buy on{' '}
                        <span className="underline">{bestBuyTiming.recommendedDateLabel}</span> or later (wait{' '}
                        {bestBuyTiming.daysToWait} {bestBuyTiming.daysToWait === 1 ? 'day' : 'days'}) and all 4
                        payments will clear your {formatOrdinal(rentDueDay)} bill day.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {plan.payIn4.schedule.map((slot, idx) => {
                    const collision = checkRentCollision(slot.isoDate || slot.date);
                    const displayAmount = activeCheckout.installments[idx] ?? 0;
                    return (
                      <div
                        key={slot.installment}
                        className={`p-3.5 rounded-xl border-2 ${
                          collision.safe ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-400'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-slate-500 block">{slot.label}</span>
                        <span className="text-xl font-black text-slate-900 mt-1 block">
                          ${displayAmount.toFixed(2)}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 block">{slot.date}</span>
                        {collision.safe ? (
                          <span className="text-[10px] text-emerald-700 font-bold mt-1.5 block">
                            ✓ Clears bill day ({formatOrdinal(rentDueDay)})
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-900 font-extrabold mt-1.5 block">
                            ⚠ Near {formatOrdinal(rentDueDay)} bill • Buy {bestBuyTiming.recommendedDateLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Checkout Bag</h3>
                    <p className="text-[11px] font-semibold text-blue-600">{activeCheckout.label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</span>
                  {activeCheckout.items.length > 0 && (
                    <span className="block text-[11px] font-extrabold text-emerald-600">
                      4x ${activeCheckout.biWeekly.toFixed(2)} / 2 wks
                    </span>
                  )}
                </div>
              </div>

              {activeCheckout.items.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Your Checkout Bag is Empty</p>
                  <p className="text-[11px] text-slate-500">
                    Click any product card on the left to add 1 or more items, or search for a new item above.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="text-xs text-slate-700 space-y-2 border-b border-slate-100 pb-3">
                    {activeCheckout.items.map(item => (
                      <li key={item.id} className="flex justify-between items-center gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="font-bold text-slate-900 shrink-0">Est. ${item.price.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>

                  {paypalClientId && plan ? (
                    <PayPalScriptProvider
                      options={{
                        clientId: paypalClientId,
                        components: 'buttons',
                        enableFunding: 'paylater',
                        currency: 'USD'
                      }}
                    >
                      {checkoutComplete ? (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-950 text-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <h4 className="font-extrabold text-sm text-emerald-900">Order Confirmed!</h4>
                          <p className="text-xs text-slate-600">
                            Paid <strong className="text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</strong> via
                            PayPal Sandbox ({checkoutComplete.status || 'COMPLETED'}).
                          </p>
                          <p className="text-[11px] font-mono text-slate-700 bg-white py-1 px-2.5 rounded border border-emerald-200 inline-block">
                            Capture ID: {checkoutComplete.captureId || checkoutComplete.id}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <PayPalButtons
                            fundingSource="paylater"
                            style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
                            forceReRender={[
                              activeCheckout.totalPrice,
                              activeCheckout.skuIds.join(','),
                              activeCheckout.cartHash
                            ]}
                            createOrder={async () => {
                              setErrorBanner(null);
                              const payload = getActiveCheckoutPayload();
                              let hashToUse = payload.cartHash;
                              if (!hashToUse && plan) {
                                hashToUse = await syncSelectionHashWithServer(payload.skuIds, plan, payload.items);
                              }
                              const res = await fetch(`${API_URL}/api/paypal/create-order`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ skuIds: payload.skuIds, cartHash: hashToUse })
                              });
                              const order = await res.json();
                              if (!res.ok || !order.id) {
                                setErrorBanner(order.error || 'Could not initialize checkout.');
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
                                setErrorBanner(capture.error || 'Payment could not be completed.');
                                return;
                              }
                              setCheckoutComplete(capture);
                            }}
                          />
                          <PayPalButtons
                            fundingSource="paypal"
                            style={{ layout: 'vertical', shape: 'rect' }}
                            forceReRender={[
                              activeCheckout.totalPrice,
                              activeCheckout.skuIds.join(','),
                              activeCheckout.cartHash
                            ]}
                            createOrder={async () => {
                              setErrorBanner(null);
                              const payload = getActiveCheckoutPayload();
                              let hashToUse = payload.cartHash;
                              if (!hashToUse && plan) {
                                hashToUse = await syncSelectionHashWithServer(payload.skuIds, plan, payload.items);
                              }
                              const res = await fetch(`${API_URL}/api/paypal/create-order`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ skuIds: payload.skuIds, cartHash: hashToUse })
                              });
                              const order = await res.json();
                              if (!res.ok || !order.id) {
                                setErrorBanner(order.error || 'Could not initialize checkout.');
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
                                setErrorBanner(capture.error || 'Payment could not be completed.');
                                return;
                              }
                              setCheckoutComplete(capture);
                            }}
                          />
                        </div>
                      )}
                    </PayPalScriptProvider>
                  ) : (
                    <p className="text-xs text-slate-400">Loading Checkout Options...</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}