import { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons, PayPalMessages } from '@paypal/react-paypal-js';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  ShoppingCart,
  RefreshCw,
  Award,
  AlertTriangle,
  Code2,
  CheckCircle2,
  XCircle,
  Send
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  tier: string;
  description: string;
}

interface ContractCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
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
    schedule: Array<{ installment: number; date: string; amount: number; label: string; rentBufferSafe: boolean }>;
    statusMessage: string;
  };
  payMonthly: {
    eligible: boolean;
    sixMonthAmount: number;
    twelveMonthAmount: number;
  };
  contracts: ContractCheck[];
  negotiationChips: Array<{ label: string; prompt: string }>;
  sourceMode: string;
}

export default function App() {
  const [judgeInfo, setJudgeInfo] = useState({
    paypalClientId: ''
  });
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState('Remote Software Engineer Ergonomic Desk Setup');
  const [budget, setBudget] = useState(140);
  const [customTradeOff, setCustomTradeOff] = useState('');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [lastOrderAudit, setLastOrderAudit] = useState<any>(null);
  const [checkoutComplete, setCheckoutComplete] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/judge-info')
      .then(res => res.json())
      .then(data => setJudgeInfo(data))
      .catch(err => console.error('Failed to load judge info:', err));

    loadScenario('Remote Software Engineer Ergonomic Desk Setup', 140);
  }, []);

  const loadScenario = async (selectedGoal: string, selectedBudget: number, tradeOffPrompt?: string) => {
    setLoading(true);
    setCheckoutComplete(null);
    setGoal(selectedGoal);
    setBudget(selectedBudget);
    try {
      const res = await fetch('http://localhost:3001/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userGoal: selectedGoal,
          biWeeklyBudget: selectedBudget,
          tradeOffPrompt
        })
      });
      const data = await res.json();
      setPlan(data);
    } catch (err) {
      console.error('Error generating bundle plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const simulateOrderCreation = async () => {
    if (!plan) return;
    const skuIds = plan.items.map(i => i.id);
    const res = await fetch('http://localhost:3001/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuIds, cartHash: plan.cartHash })
    });
    const order = await res.json();
    setLastOrderAudit(order);
  };

  // AG Grid Enterprise Column Definitions with Grouping & Aggregations
  const columnDefs: ColDef<Product>[] = [
    { 
      field: 'category', 
      headerName: 'Category', 
      rowGroup: true, 
      hide: true 
    },
    { field: 'name', headerName: 'Bundle Item', flex: 2, sortable: true, filter: true },
    { field: 'tier', headerName: 'Tier', flex: 1, sortable: true },
    {
      field: 'price',
      headerName: 'Canonical Price',
      flex: 1,
      aggFunc: 'sum',
      valueFormatter: p => (typeof p.value === 'number' ? `$${p.value.toFixed(2)}` : '$0.00')
    },
    {
      headerName: 'Pay in 4 (/2 Wks)',
      flex: 1,
      valueGetter: p => (p.data ? Number((p.data.price / 4).toFixed(2)) : 0),
      aggFunc: 'sum',
      valueFormatter: p => (typeof p.value === 'number' ? `$${p.value.toFixed(2)}` : '$0.00')
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOP BAR: Clean 1-Click Judge Presets Bar */}
      <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Award className="text-paypal-yellow w-5 h-5" />
          <span className="font-bold text-xs tracking-wider uppercase text-slate-200">
            1-Click Judge Mode
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Instant Presets:</span>
          <button
            onClick={() => loadScenario('Remote Software Engineer Ergonomic Desk Setup', 140)}
            className="text-xs bg-slate-800 hover:bg-blue-900 px-3 py-1.5 rounded-full border border-slate-600 transition"
          >
            1. WFH Desk ($140/2wks Sweet Spot)
          </button>
          <button
            onClick={() => loadScenario('Ultra Broadcast Executive Rig', 360, 'FORCE_OVER_1500_TEST')}
            className="text-xs bg-amber-950/80 hover:bg-amber-900 text-amber-200 px-3 py-1.5 rounded-full border border-amber-700 transition"
          >
            2. Test $1,500 Pay in 4 Limit Guardrail
          </button>
          <button
            onClick={() => loadScenario('Creator Podcast & Streaming Studio', 165, 'Prioritize VocalCast XLR mic and 4K monitor')}
            className="text-xs bg-slate-800 hover:bg-blue-900 px-3 py-1.5 rounded-full border border-slate-600 transition"
          >
            3. Creator Studio ($165/2wks)
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-xs text-slate-300">
          <span>PayPal Sandbox Mode Active</span>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <header className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-paypal-dark flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-paypal-blue" />
              SplitCart <span className="text-paypal-blue">AI</span>
            </h1>
            <p className="text-slate-600 text-sm mt-0.5">
              Agentic Bundle Negotiator & PayPal Pay Later Cash-Flow Optimizer
            </p>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-950 px-4 py-2 rounded-lg text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-paypal-blue shrink-0" />
            <span>
              <strong>Trust Boundary:</strong> Gemini selects SKUs only; Deterministic Node.js computes BNPL math & locks SHA-256 cart hash.
            </span>
          </div>
        </header>

        {/* Custom Goal & Budget Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Project / Shopping Goal</label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-paypal-blue"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Max Bi-Weekly Cap ($/2wks)
            </label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-paypal-dark focus:outline-none focus:border-paypal-blue"
            />
          </div>
          <button
            onClick={() => loadScenario(goal, budget)}
            disabled={loading}
            className="bg-paypal-blue hover:bg-paypal-dark text-white font-semibold px-5 py-2 rounded-lg text-sm transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Architect Bundle
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: Bundle Grid, Negotiation Chips & Cash-Flow Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              {plan && (
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{plan.bundleName}</h2>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        Hash: {plan.cartHash}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{plan.rationale}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900">${plan.totalPrice.toFixed(2)}</span>
                    {plan.payIn4.eligible ? (
                      <p className="text-xs font-bold text-emerald-600">
                        4 payments of ${plan.payIn4.biWeeklyAmount.toFixed(2)} (0% APR)
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-amber-600">
                        Exceeds $1,500 Pay in 4 limit • Use Pay Monthly (${plan.payMonthly.twelveMonthAmount}/mo)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* AG Grid Enterprise Table with Row Grouping & Aggregations */}
              <div className="w-full h-64 min-h-[250px] border border-slate-200 rounded-lg overflow-hidden bg-white">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50 text-sm text-slate-500 gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-paypal-blue" />
                    <span>Gemini is optimizing your bundle & checking PayPal BNPL rules...</span>
                  </div>
                ) : (
                  <div className="ag-theme-alpine w-full h-full">
                    <AgGridReact
                      rowData={plan?.items || []}
                      columnDefs={columnDefs}
                      autoGroupColumnDef={{ headerName: 'Category / Item', flex: 2 }}
                      groupDefaultExpanded={1}
                    />
                  </div>
                )}
              </div>

              {/* Agentic Trade-Off Negotiator Bar */}
              {plan && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
                    <Sparkles className="w-4 h-4 text-paypal-blue" />
                    <span>1-Click Agentic Trade-Off Negotiator:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plan.negotiationChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => loadScenario(goal, budget, chip.prompt)}
                        className="text-xs bg-white hover:bg-blue-50 text-paypal-dark border border-blue-200 font-medium px-3 py-1.5 rounded-lg shadow-sm transition"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Or ask Gemini to negotiate a custom swap (e.g., 'Upgrade monitor to 4K, keep under $155/2wks')..."
                      value={customTradeOff}
                      onChange={e => setCustomTradeOff(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      onClick={() => {
                        if (customTradeOff.trim()) {
                          loadScenario(goal, budget, customTradeOff);
                          setCustomTradeOff('');
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Negotiate
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6-Week Bi-Weekly Cash-Flow Schedule & Merchant vs Buyer Value */}
            {plan && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">
                    6-Week PayPal Pay in 4 Cash-Flow Schedule (Merchant Settled 100% Day 1)
                  </h3>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                    Merchant Upfront Payout: ${plan.totalPrice.toFixed(2)} Today
                  </span>
                </div>

                {plan.payIn4.eligible ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {plan.payIn4.schedule.map(slot => (
                      <div key={slot.installment} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] font-semibold text-slate-500 block">{slot.label}</span>
                        <span className="text-lg font-extrabold text-paypal-dark mt-1 block">
                          ${slot.amount.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 block">{slot.date}</span>
                        <span className="text-[10px] text-emerald-600 font-medium mt-1 block">
                          ✓ 0% APR • Rent-Day Safe
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-amber-900 text-xs">
                      <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold text-sm">PayPal Pay in 4 Cap Exceeded ($1,500 Max)</p>
                        <p>{plan.payIn4.statusMessage}</p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        loadScenario(
                          goal,
                          350,
                          'Downgrade monitor from Reference OLED to 4K StudioMaster so total cart drops under $1,500 and unlocks 0% APR Pay in 4'
                        )
                      }
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0"
                    >
                      Auto-Fix Under $1,500
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live PayPal Pay Later Checkout & Deterministic Guardrail Audit */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base mb-3">
                PayPal Pay Later Sandbox Checkout
              </h3>

              {judgeInfo.paypalClientId && plan ? (
                <PayPalScriptProvider
                  options={{
                    clientId: judgeInfo.paypalClientId,
                    components: 'buttons,messages',
                    enableFunding: 'paylater',
                    currency: 'USD'
                  }}
                >
                  {/* Official Dynamic PayPal Pay Later Messaging */}
                  <div className="mb-4 p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                    <PayPalMessages
                      amount={plan.totalPrice}
                      style={{ layout: 'text', logo: { type: 'primary' } }}
                    />
                  </div>

                  {checkoutComplete ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-sm">PayPal Sandbox Order Captured!</h4>
                      <p className="text-xs font-mono bg-white p-1.5 rounded border border-emerald-200">
                        Order ID: {checkoutComplete.id}
                      </p>
                      <p className="text-xs text-slate-600">
                        Order <strong>{checkoutComplete.status}</strong>. Your payment of ${plan.totalPrice.toFixed(2)} was successfully processed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <PayPalButtons
                        fundingSource="paylater"
                        style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
                        forceReRender={[plan.totalPrice, plan.cartHash]}
                        createOrder={async () => {
                          const skuIds = plan.items.map(i => i.id);
                          const res = await fetch('http://localhost:3001/api/paypal/create-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ skuIds, cartHash: plan.cartHash })
                          });
                          const order = await res.json();
                          setLastOrderAudit(order);
                          return order.id;
                        }}
                        onApprove={async (data: any) => {
                          const res = await fetch('http://localhost:3001/api/paypal/capture-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID })
                          });
                          const capture = await res.json();
                          setCheckoutComplete(capture);
                        }}
                      />
                      <PayPalButtons
                        fundingSource="paypal"
                        style={{ layout: 'vertical', shape: 'rect' }}
                        forceReRender={[plan.totalPrice, plan.cartHash]}
                        createOrder={async () => {
                          const skuIds = plan.items.map(i => i.id);
                          const res = await fetch('http://localhost:3001/api/paypal/create-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ skuIds, cartHash: plan.cartHash })
                          });
                          const order = await res.json();
                          setLastOrderAudit(order);
                          return order.id;
                        }}
                        onApprove={async (data: any) => {
                          const res = await fetch('http://localhost:3001/api/paypal/capture-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID })
                          });
                          const capture = await res.json();
                          setCheckoutComplete(capture);
                        }}
                      />
                    </div>
                  )}
                </PayPalScriptProvider>
              ) : (
                <p className="text-xs text-slate-400">Loading PayPal Sandbox SDK...</p>
              )}

              {/* 1-Click API Order Inspector for Fast Judge Verification */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={simulateOrderCreation}
                  className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <Code2 className="w-4 h-4 text-paypal-blue" />
                  1-Click Inspect Live PayPal Orders v2 Payload
                </button>
                {lastOrderAudit && (
                  <pre className="mt-2 p-2.5 bg-slate-900 text-emerald-400 text-[10px] rounded-lg overflow-x-auto max-h-44 font-mono">
                    {JSON.stringify(lastOrderAudit, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Deterministic Pre-Flight Contract Gate */}
            {plan && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Pre-Flight Financial Contracts
                  </h4>
                  <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    {plan.contracts.filter(c => c.passed).length}/{plan.contracts.length} Passed
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
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}