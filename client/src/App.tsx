import { useState, useEffect, useRef } from 'react';
import { PayPalScriptProvider, PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Send,
  Split,
  Calendar,
  TrendingDown,
  Search
} from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import type { Product, PlanData } from './types/bundle.types';
import { API_URL, fetchClientConfig, requestBundlePlan } from './services/splitcart-api.client';

const EXPLORE_IDEAS = [
  { label: 'Home Espresso Bar', goal: 'Craft Home Espresso & Matcha Bar Setup', budget: 160 },
  { label: '2-Person Camping Kit', goal: 'Ultralight 2-Person Weekend Camping Gear Setup', budget: 125 },
  { label: 'Baby Nursery', goal: 'Modern Newborn Baby Nursery & Monitor Setup', budget: 180 },
  { label: 'Compact Home Gym', goal: 'Apartment Adjustable Dumbbell & Cardio Home Gym', budget: 150 },
  { label: 'Home Office Desk', goal: 'Remote Software Engineer Ergonomic Desk Setup', budget: 140 },
  { label: 'Pro Video Studio', goal: '4K Cinema Camera & Podcast Studio Kit', budget: 380, prompt: 'Select flagship pro models totaling around $1,700' }
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
        label: 'Phase 1: Essentials (Buy Today)',
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
      label: 'Complete Bundle',
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

  const columnDefs: ColDef<Product>[] = [
    {
      field: 'phase',
      headerName: 'Recommended Phase',
      width: 160,
      cellRenderer: (p: any) =>
        p.value === 'PHASE_1_TODAY' ? 'Buy Today (Essential)' : 'Wait 28d (Upgrade)'
    },
    { field: 'category', headerName: 'Category', width: 140, sortable: true },
    {
      field: 'name',
      headerName: 'Item',
      flex: 2,
      sortable: true,
      filter: true
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 120,
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
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* SHOPPING SEARCH & BUDGET CONTROLS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                What are you shopping for?
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={goal}
                  placeholder="Search any project or setup (e.g., Espresso Bar, Baby Nursery, Camping Gear)..."
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
                2-Week Comfort Budget
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
                <option value={1}>1st of Month</option>
                <option value={10}>10th of Month</option>
                <option value={15}>15th of Month</option>
                <option value={24}>24th of Month</option>
              </select>
            </div>

            <button
              onClick={() => loadScenario(goal, budget)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Finding Items...' : 'Build My Bundle'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Explore:</span>
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
          {/* LEFT 2 COLUMNS: Bundle Items, Customizer & Payment Schedule */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              {plan && (
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div className="max-w-xl">
                    <h2 className="text-xl font-bold text-slate-900">{plan.bundleName}</h2>
                    <p className="text-sm text-slate-600 mt-1">{plan.rationale}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">${plan.totalPrice.toFixed(2)}</span>
                    {plan.payIn4.eligible ? (
                      <p className="text-xs font-bold text-emerald-600">
                        4 interest-free payments of ${plan.payIn4.biWeeklyAmount.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-amber-600">
                        Over $1,500 Pay in 4 limit - Split into 2 phases below for 0% APR
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="w-full h-64 min-h-[250px] border border-slate-200 rounded-lg overflow-hidden bg-white">
                {loading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-sm text-slate-600 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="font-semibold">Curating items for your budget...</span>
                  </div>
                ) : (
                  <div className="ag-theme-alpine w-full h-full">
                    <AgGridReact rowData={plan?.items || []} columnDefs={columnDefs} />
                  </div>
                )}
              </div>

              {plan && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Adjust Your Bundle:</span>
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
                      placeholder="Ask to swap an item or adjust price (e.g., 'Use a cheaper grinder', 'Keep total under $450')..."
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
                      <Send className="w-3.5 h-3.5" /> Update
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PAYMENT SCHEDULE & PHASED PLANNER */}
            {plan && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      Your 4-Payment Schedule ({activeCheckout.label})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Payments are spaced every 2 weeks and checked against your bill due date ({rentDueDay}th of the month).
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPhasedPlanner(!showPhasedPlanner)}
                    className="text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Split className="w-3.5 h-3.5" />
                    {showPhasedPlanner
                      ? 'Hide 2-Phase Option'
                      : `Lower Today's Payment (-$${plan.phasedSplit.peakBiWeeklyDrop.toFixed(2)}/2wks)`}
                  </button>
                </div>

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
                              No conflict with bill day ({rentDueDay})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-800 font-bold mt-1 block">
                              Close to bill day ({rentDueDay}) - Consider waiting {collision.shiftDays}d
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {(showPhasedPlanner || !plan.payIn4.eligible) && (
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Split className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          2-Phase Paycheck Plan (Buy Essentials Now, Upgrades Next Month)
                        </h4>
                      </div>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                        Starts at ${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)}/2wks Today
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
                            <span className="text-[11px] text-emerald-600 font-bold">
                              4 payments of ${plan.phasedSplit.phase1.biWeeklyAmount.toFixed(2)} (0% APR)
                            </span>
                          </div>
                          <span className="text-base font-black text-slate-900">
                            ${plan.phasedSplit.phase1.totalPrice.toFixed(2)}
                          </span>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1 mb-3">
                          {plan.phasedSplit.phase1.items.map(item => (
                            <li key={item.id} className="flex justify-between">
                              <span className="truncate pr-2">- {item.name}</span>
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
                          {checkoutMode === 'PHASE_1' ? 'Selected for Checkout' : 'Buy Phase 1 Essentials Today'}
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
                            <span className="text-[11px] text-emerald-600 font-bold">
                              4 payments of ${plan.phasedSplit.phase2.biWeeklyAmount.toFixed(2)} (0% APR)
                            </span>
                          </div>
                          <span className="text-base font-black text-slate-900">
                            ${plan.phasedSplit.phase2.totalPrice.toFixed(2)}
                          </span>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1 mb-3">
                          {plan.phasedSplit.phase2.items.map(item => (
                            <li key={item.id} className="flex justify-between">
                              <span className="truncate pr-2">- {item.name}</span>
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
                          {checkoutMode === 'PHASE_2' ? 'Selected for Checkout' : 'Select Phase 2 Upgrades'}
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
                          Switch back to Complete Bundle (${plan.totalPrice.toFixed(2)})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Clean Consumer Checkout Card */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Order Summary</h3>
                  <p className="text-xs text-slate-500">{activeCheckout.label}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</span>
                  <span className="block text-[11px] font-bold text-emerald-600">
                    4x ${activeCheckout.biWeekly.toFixed(2)} / 2 wks
                  </span>
                </div>
              </div>

              <ul className="text-xs text-slate-600 space-y-1.5 border-b border-slate-100 pb-3">
                {activeCheckout.items.map(item => (
                  <li key={item.id} className="flex justify-between">
                    <span className="truncate pr-2">{item.name}</span>
                    <span className="font-semibold text-slate-800 shrink-0">${item.price.toFixed(2)}</span>
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
                  <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                    <PayPalMessages
                      amount={activeCheckout.totalPrice}
                      style={{ layout: 'text', logo: { type: 'primary' } }}
                    />
                  </div>

                  {checkoutComplete ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-sm text-emerald-900">Order Confirmed!</h4>
                      <p className="text-xs text-slate-600">
                        Your PayPal order of{' '}
                        <strong className="text-slate-900">${activeCheckout.totalPrice.toFixed(2)}</strong> has been
                        completed.
                      </p>
                      <p className="text-[11px] font-mono text-slate-600 bg-white py-1 px-2.5 rounded border border-emerald-200 inline-block">
                        Confirmation ID: {checkoutComplete.captureId || checkoutComplete.id}
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

