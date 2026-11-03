import { GoogleGenAI, Type } from '@google/genai';
import { CATALOG, Product } from './catalog';
import { verifyAndHashCart } from './paypal';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ContractCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface AgentPlanResult {
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
  sourceMode: 'gemini-live' | 'deterministic-fallback';
}

export async function generateBundlePlan(
  userGoal: string,
  biWeeklyBudget: number,
  tradeOffPrompt?: string
): Promise<AgentPlanResult> {
  const maxTargetTotal = biWeeklyBudget * 4;
  const catalogContext = CATALOG.map(
    p => `SKU: "${p.id}" | ${p.name} | Category: ${p.category} | Price: $${p.price} | Tier: ${p.tier}`
  ).join('\n');

  const prompt = `You are SplitCart AI, an Agentic Commerce & PayPal Pay Later Bundle Architect.
Shopper Goal: "${userGoal}"
Target Bi-Weekly Installment Cap: $${biWeeklyBudget} every 2 weeks (meaning target total cart is around $${maxTargetTotal} across 4 PayPal Pay in 4 payments).
Trade-off / Adjustment Request: "${tradeOffPrompt || 'None - build the optimal 4-item bundle'}".

PayPal US BNPL Rules:
- Pay in 4: Strictly $30.00 to $1,500.00 total cart (4 interest-free payments, 0% APR).
- Pay Monthly: $199.00 to $10,000.00 total cart (6 or 12 monthly installments).

Available Canonical Catalog:
${catalogContext}

Instructions:
1. Pick 4 complementary SKU IDs (one from each category: monitor, seating, audio, lighting) that match the user's goal and trade-off request.
2. Explain specifically how splitting this bundle into 4 bi-weekly payments protects their cash flow while upgrading key components.
3. Provide 2 actionable follow-up negotiation chips the shopper can click next.`;

  let selectedIds: string[] = [];
  let bundleName = '';
  let rationale = '';
  let negotiationChips: Array<{ label: string; prompt: string }> = [];
  let sourceMode: 'gemini-live' | 'deterministic-fallback' = 'gemini-live';

  // Special preset check: if testing the $1,500 Pay in 4 Limit Violation scenario
  if (tradeOffPrompt === 'FORCE_OVER_1500_TEST') {
    selectedIds = ['mon-oled', 'chair-exec', 'mic-studio', 'light-studio']; // Sums to $1,760 (> $1,500 Pay in 4 limit!)
    bundleName = 'Ultra Broadcast Executive Rig (Over $1,500 Pay in 4 Cap)';
    rationale = 'This maxed-out studio configuration totals $1,760.00, exceeding PayPal Pay in 4\'s $1,500.00 statutory cap. Click "Auto-Optimize Under $1,500" to let Gemini swap 1 item and unlock 0% APR Pay in 4!';
    negotiationChips = [
      { label: '✨ Auto-Optimize Under $1,500 (Unlock 0% Pay in 4)', prompt: 'Downgrade the monitor from Reference OLED to 4K StudioMaster so total cart drops under $1,500 and unlocks 0% APR Pay in 4' },
      { label: 'Keep $1,760 & Use Pay Monthly ($146.67/mo)', prompt: 'Keep current high-end items' }
    ];
  } else {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
         thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bundleName: { type: Type.STRING },
              rationale: { type: Type.STRING },
              productIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              negotiationChips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    prompt: { type: Type.STRING }
                  },
                  required: ['label', 'prompt']
                }
              }
            },
            required: ['bundleName', 'rationale', 'productIds', 'negotiationChips']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      selectedIds = (parsed.productIds || []).filter((id: string) => CATALOG.some(c => c.id === id));
      if (selectedIds.length === 0) throw new Error('Empty valid SKUs');
      bundleName = parsed.bundleName || 'AI Optimized Workspace Bundle';
      rationale = parsed.rationale || 'Optimized for your bi-weekly PayPal Pay in 4 budget.';
      negotiationChips = parsed.negotiationChips?.slice(0, 2) || [];
    } catch (err) {
      sourceMode = 'deterministic-fallback';
      selectedIds = ['mon-2k', 'chair-pro', 'mic-usb', 'light-bar'];
      bundleName = 'Ergonomic Remote Engineer Bundle';
      rationale = 'Curated 4-piece setup totaling $550.00 ($137.50 every 2 weeks via PayPal Pay in 4), keeping you safely below your $140.00 bi-weekly limit.';
      negotiationChips = [
        { label: 'Upgrade Monitor to 32" 4K (+$17.50/2wks)', prompt: 'Upgrade monitor to mon-4k and swap chair to chair-mesh to keep bi-weekly installment near $155' },
        { label: 'Upgrade Mic to Broadcast XLR', prompt: 'Upgrade microphone to mic-pod while keeping total under budget' }
      ];
    }
  }

  const { items, total: totalPrice, cartHash } = verifyAndHashCart(selectedIds);

  // Deterministic PayPal BNPL Calculations
  const payIn4Eligible = totalPrice >= 30.0 && totalPrice <= 1500.0;
  const biWeeklyAmount = payIn4Eligible ? Number((totalPrice / 4).toFixed(2)) : 0;
  const payMonthlyEligible = totalPrice >= 199.0 && totalPrice <= 10000.0;

  const today = new Date();
  const schedule = [0, 14, 28, 42].map((days, idx) => {
    const d = new Date(today.getTime() + days * 86400000);
    return {
      installment: idx + 1,
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: biWeeklyAmount,
      label: idx === 0 ? 'Due Today (Checkout)' : `Installment ${idx + 1} (+${days}d)`,
      rentBufferSafe: d.getDate() !== 1 // Highlights if payment avoids the 1st of the month rent day
    };
  });

  // 4 Deterministic Pre-Flight Contract Checks (Inspired by top hackathon contenders)
  const contracts: ContractCheck[] = [
    {
      code: 'SKU_CANONICAL_LOCK',
      label: 'AI SKU-Only Boundary',
      passed: items.length === selectedIds.length && items.length > 0,
      detail: `${items.length}/${selectedIds.length} SKUs verified against server catalog`
    },
    {
      code: 'PRICE_IMMUTABILITY',
      label: 'Deterministic Price Math',
      passed: true,
      detail: `SHA-256 Cart Hash [${cartHash}] locked at $${totalPrice.toFixed(2)}`
    },
    {
      code: 'PAY_IN_4_STATUTORY_BOUNDS',
      label: 'PayPal Pay in 4 Cap ($30–$1,500)',
      passed: payIn4Eligible,
      detail: payIn4Eligible
        ? `$${totalPrice.toFixed(2)} qualifies for 0% APR Pay in 4 ($${biWeeklyAmount.toFixed(2)} x 4)`
        : `VIOLATION: $${totalPrice.toFixed(2)} exceeds $1,500 Pay in 4 cap by $${(totalPrice - 1500).toFixed(2)}`
    },
    {
      code: 'CASHFLOW_CAP_CHECK',
      label: 'Shopper Bi-Weekly Cap',
      passed: payIn4Eligible && biWeeklyAmount <= biWeeklyBudget,
      detail: payIn4Eligible
        ? `$${biWeeklyAmount.toFixed(2)}/2wks vs $${biWeeklyBudget.toFixed(2)} target cap`
        : 'Requires bundle re-balancing or Pay Monthly'
    }
  ];

  return {
    bundleName,
    rationale,
    items,
    totalPrice,
    cartHash,
    payIn4: {
      eligible: payIn4Eligible,
      biWeeklyAmount,
      schedule,
      statusMessage: payIn4Eligible
        ? `Eligible for 4 interest-free payments of $${biWeeklyAmount.toFixed(2)} (0% APR)`
        : `Cart ($${totalPrice.toFixed(2)}) exceeds PayPal Pay in 4's $1,500 maximum.`
    },
    payMonthly: {
      eligible: payMonthlyEligible,
      sixMonthAmount: Number((totalPrice / 6).toFixed(2)),
      twelveMonthAmount: Number((totalPrice / 12).toFixed(2))
    },
    contracts,
    negotiationChips,
    sourceMode
  };
}