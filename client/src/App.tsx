import { useState, useEffect, useRef } from 'react';
import { PayPalScriptProvider, PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
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
  Check
} from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import type { PlanData } from './types/bundle.types';
import { API_URL, fetchClientConfig, requestBundlePlan } from './services/splitcart-api.client';

const EXPLORE_IDEAS = [
  { label: '☕ Home Espresso Bar', goal: 'Craft Home Espresso & Matcha Bar Setup', budget: 160 },
  { label: '⛺ 2-Person Camping Kit', goal: 'Ultralight 2-Person Weekend Camping Gear Setup', budget: 125 },
  { label: '👶 Baby Nursery', goal: 'Modern Newborn Baby Nursery & Monitor Setup', budget: 180 },
  { label: '🏋️ Compact Home Gym', goal: 'Apartment Adjustable Dumbbell & Cardio Home Gym', budget: 150 },
  { label: '💻 Home Office Desk', goal: 'Remote Software Engineer Ergonomic Desk Setup', budget: 140 },
  {
    label: '🎥 Pro Video Studio ($1,680+)',
    goal: '4K Cinema Camera & Podcast Studio Kit',
    budget: 420,
    prompt: 'Select flagship pro models totaling around $1,700'
  }
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

  const loadScenario = async (selectedGoal: string, selectedBudget: number, tradeOffPrompt?: string) => {
    const reqId = ++requestCounterRef.current;
    setLoading(true);
    setErrorBanner(null);
    setCheckoutComplete(null);
    setGoal(selectedGoal);
    setBudget(selectedBudget);

    try {
      const data = await requestBundlePlan({
        userGoal: selectedGoal,
        biWeeklyBudget: selectedBudget,
        tradeOffPrompt,
        rentDueDay
      });

      if (reqId !== requestCounterRef.current) return;

      setPlan(data);
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

  const getActiveCheckoutPayload = () => {
    if (!plan) {
      return { skuIds: [], cartHash: '', totalPrice: 0, biWeekly: 0, label: 'Complete Bundle', items: [] };
    }
    if (checkoutMode === 'PHASE_1') {
      const p1 = plan.phasedSplit.phase1;
      return {
        skuIds: p1.skuIds,
        cartHash: p1.cartHash,
        totalPrice: p1.totalPrice,
        biWeekly: p1.biWeeklyAmount,
        label: 'Phase 1: Day-1 Essentials (Buy Today)',
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
        label: 'Phase 2: Upgrades (+28 Days)',
        items: p2.items
      };
    }
    return {
      skuIds: plan.items.map(i => i.id),
      cartHash: plan.cartHash,
      totalPrice: plan.totalPrice,
      biWeekly: plan.payIn4.biWeeklyAmount,
      label: 'All 4 Curated Items',
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

  const activeCheckout = getActiveCheckoutPayload();
  const activeSkuSet = new Set(activeCheckout.skuIds);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* VIBRANT HERO & BUDGET PLANNER BAR */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-sky-300 border border-sky-400/30 px-2.5 py-0.5 rounded-full mb-2">
                <Sparkles className="w-3 h-3" /> PayPal Pay in 4 Cash-Flow Planner
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Shop Any Goal Without Colliding With Rent Day
              </h1>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>0% APR Pay in 4 • Bi-Weekly Paycheck Staggering</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-4 rounded-xl text-slate-900 shadow-sm">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                What are you shopping for? (Item or Project)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={goal}
                  placeholder="e.g., Espresso Bar, Sony Camera, Baby Nursery..."
                  onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) loadScenario(goal, budget);
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
                  type="number"
                  min={15}
                  max={2000}
                  value={budget}
                  onChange={e => setBudget(Math.max(15, Number(e.target.value) || 0))}
                  className="w-full pl-7 pr-16 py-2 border border-slate-300 rounded-lg text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-600"
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
                onClick={() => loadScenario(goal, budget)}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? 'Curating...' : 'Plan Cart'}
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
          {/* LEFT 2 COLUMNS: Consumer Product Cards & Paycheck Schedule */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              {plan && (
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-100">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Curated Retail Bundle
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Target Cap: ${budget}/2wks (${budget * 4} total)
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900">{plan.bundleName}</h2>
                    <p className="text-xs text-slate-600 mt-1">{plan.rationale}</p>
                  </div>
                  <div className="text-right bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block">Full Bundle Total</span>
                    <span className="text-2xl font-black text-slate-900">${plan.totalPrice.toFixed(2)}</span>
                    {plan.payIn4.eligible ? (
                      <p className="text-xs font-bold text-emerald-600">
                        4x ${plan.payIn4.biWeeklyAmount.toFixed(2)} / 2 wks (0% APR)
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-amber-600">
                        Exceeds $1,500 limit • Auto-split into 2 phases
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* PHASE FILTER TABS ABOVE CARDS */}
              {plan && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-xl">
                  <button
                    onClick={() => {
                      setCheckoutMode('FULL');
                      setCheckoutComplete(null);
                    }}
                    disabled={!plan.payIn4.eligible}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      checkoutMode === 'FULL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                    }`}
                  >
                    All 4 Items (${plan.totalPrice.toFixed(2)} • ${plan.payIn4.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                  <button
                    onClick={() => {
                      setCheckoutMode('PHASE_1');
                      setCheckoutComplete(null);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      checkoutMode === 'PHASE_1'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    Phase 1: Buy Today (${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                  <button
                    onClick={() => {
                      setCheckoutMode('PHASE_2');
                      setCheckoutComplete(null);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      checkoutMode === 'PHASE_2'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    Phase 2: Wait +28d (${plan.phasedSplit.phase2.biWeeklyAmount.toFixed(2)}/2wks)
                  </button>
                </div>
              )}

              {/* MODERN CONSUMER PRODUCT CARDS (NO AG GRID) */}
              {loading ? (
                <div className="w-full py-16 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 gap-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="font-bold text-slate-800">Finding real retail products & calculating installments...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(plan?.items || []).map(item => {
                    const isPhase1 = item.phase === 'PHASE_1_TODAY';
                    const isIncludedInActiveCart = activeSkuSet.has(item.id);
                    const itemBiWeekly = (item.price / 4).toFixed(2);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setCheckoutMode(isPhase1 ? 'PHASE_1' : 'PHASE_2');
                          setCheckoutComplete(null);
                        }}
                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          isIncludedInActiveCart
                            ? 'bg-white border-blue-600 shadow-sm'
                            : 'bg-slate-50/70 border-slate-200 opacity-65 hover:opacity-100'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                isPhase1
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {isPhase1 ? 'Paycheck 1 • Buy Today' : 'Paycheck 2 • Wait 28 Days'}
                            </span>
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                                isIncludedInActiveCart
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            <span>{item.brand || 'Verified Retail'}</span>
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
                            <span className="text-xs text-slate-400 font-medium">Retail: </span>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Customize or Swap Items with AI:</span>
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
                      placeholder="Ask AI to swap any item or change budget (e.g., 'Swap to a cheaper grinder', 'Keep under $450')..."
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
                      <Send className="w-3.5 h-3.5" /> Update Cart
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PAYMENT SCHEDULE & RENT-DAY COLLISION GUARD */}
            {plan && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      Your 4-Payment Timeline ({activeCheckout.label})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Checked against your major bill / rent due date ({rentDueDay}th of the month) to prevent overdrafts.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPhasedPlanner(!showPhasedPlanner)}
                    className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Split className="w-3.5 h-3.5" />
                    {showPhasedPlanner
                      ? 'Hide 2-Phase Breakdown'
                      : `Cut Today's Payment by -$${plan.phasedSplit.peakBiWeeklyDrop.toFixed(2)}/2wks`}
                  </button>
                </div>

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
                            ✓ Safe from bill day ({rentDueDay}th)
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-900 font-extrabold mt-1.5 block">
                            ⚠ Near Rent ({rentDueDay}th) • Wait {collision.shiftDays}d
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Sticky Consumer Checkout Bag */}
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
                  <span className="block text-[11px] font-extrabold text-emerald-600">
                    4x ${activeCheckout.biWeekly.toFixed(2)} / 2 wks
                  </span>
                </div>
              </div>

              <ul className="text-xs text-slate-700 space-y-2 border-b border-slate-100 pb-3">
                {activeCheckout.items.map(item => (
                  <li key={item.id} className="flex justify-between items-center gap-2">
                    <span className="font-medium truncate">{item.name}</span>
                    <span className="font-bold text-slate-900 shrink-0">${item.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {paypalClientId && plan ? (
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId,
                    components: 'buttons,messages',
                    enableFunding: 'paylater',
                    currency: 'USD'
                  }}
                >
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
                    <PayPalMessages
                      amount={activeCheckout.totalPrice}
                      style={{ layout: 'text', logo: { type: 'primary' } }}
                    />
                  </div>

                  {checkoutComplete ? (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-950 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h4 className="font-extrabold text-sm text-emerald-900">PayPal Order Confirmed!</h4>
                      <p className="text-xs text-slate-600">
                        Paid <strong className="text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</strong> via
                        PayPal Sandbox.
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
                          if (!res.ok || !order.id) {
                            setErrorBanner(order.error || 'Could not initialize PayPal checkout.');
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
                          if (!res.ok || !order.id) {
                            setErrorBanner(order.error || 'Could not initialize PayPal checkout.');
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
                <p className="text-xs text-slate-400">Loading PayPal Checkout...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}