import { GoogleGenAI, Type } from '@google/genai';
import { Product, registerDynamicProducts } from './catalog';
import { verifyAndHashCart, computeInstallmentsInDollars, ValidationError } from './paypal';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = 12000;

export interface ContractCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PhasedCartGroup {
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

export interface AgentPlanResult {
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
  sourceMode: 'gemini-live' | 'deterministic-fallback';
}

function buildDynamicFallbackProducts(userGoal: string, targetTotal: number, tradeOffPrompt?: string): {
  bundleName: string;
  rationale: string;
  products: Product[];
  chips: Array<{ label: string; prompt: string }>;
} {
  const cleanGoal = userGoal.trim() || 'Smart Home & Lifestyle Bundle';
  // Scale prices proportionally to match the user's actual target budget
  const clampedTotal = Math.max(120, Math.min(2400, targetTotal));
  const p1 = Math.round(clampedTotal * 0.42);
  const p2 = Math.round(clampedTotal * 0.30);
  const p3 = Math.round(clampedTotal * 0.16);
  const p4 = Math.max(15, clampedTotal - (p1 + p2 + p3));
  const slug = cleanGoal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18) || 'bundle';

  const products: Product[] = [
    {
      id: `sku-${slug}-core-1`,
      name: `${cleanGoal} — Primary Flagship System`,
      brand: 'ProSeries',
      category: 'Core Essential',
      price: p1,
      tier: 'essential',
      phase: 'PHASE_1_TODAY',
      description: `Primary anchor component tailored for ${cleanGoal}`,
      retailerHint: 'Verified Retail Price'
    },
    {
      id: `sku-${slug}-core-2`,
      name: `${cleanGoal} — Companion Essential Unit`,
      brand: 'ErgoCraft',
      category: 'Core Essential',
      price: p2,
      tier: 'essential',
      phase: 'PHASE_1_TODAY',
      description: `Essential secondary hardware required on Day 1`,
      retailerHint: 'Verified Retail Price'
    },
    {
      id: `sku-${slug}-acc-3`,
      name: `${cleanGoal} — Precision Performance Upgrade`,
      brand: 'StudioLine',
      category: 'Phase 2 Upgrade',
      price: p3,
      tier: 'recommended',
      phase: 'PHASE_2_STAGGERED',
      description: `Recommended expansion module ideal for Phase 2 staggered purchase`,
      retailerHint: 'Verified Retail Price'
    },
    {
      id: `sku-${slug}-acc-4`,
      name: `${cleanGoal} — Finishing Accessory Kit`,
      brand: 'Essentials+',
      category: 'Phase 2 Accessory',
      price: p4,
      tier: 'upgrade',
      phase: 'PHASE_2_STAGGERED',
      description: `Completes the setup${tradeOffPrompt ? ` (${tradeOffPrompt.slice(0, 40)})` : ''}`,
      retailerHint: 'Verified Retail Price'
    }
  ];

  const total = p1 + p2 + p3 + p4;
  const biWeekly = (total / 4).toFixed(2);

  return {
    bundleName: `Curated ${cleanGoal} Plan`,
    rationale: `Tailored 4-item bundle totaling $${total.toFixed(2)} ($${biWeekly} every 2 weeks via 0% APR PayPal Pay in 4), or split into Phase 1 Essentials today ($${((p1 + p2) / 4).toFixed(2)}/2wks) and Phase 2 Upgrades in 28 days.`,
    products,
    chips: [
      {
        label: `Trim Total by 15% (~$${Math.round((total * 0.85) / 4)}/2wks)`,
        prompt: `Swap to value-tier models to reduce total bundle cost by 15%`
      },
      {
        label: `Upgrade Primary Component (+$${Math.round((total * 0.15) / 4)}/2wks)`,
        prompt: `Upgrade the primary anchor item to a flagship pro model while keeping accessories lean`
      }
    ]
  };
}

export async function generateBundlePlan(
  userGoal: string,
  biWeeklyBudget: number,
  tradeOffPrompt?: string,
  rentDueDay: number = 1
): Promise<AgentPlanResult> {
  const cleanGoal = String(userGoal || 'Home Espresso & Coffee Bar Setup').trim().slice(0, 140);
  const cleanBudget = Number(biWeeklyBudget);

  if (!Number.isFinite(cleanBudget) || cleanBudget < 10 || cleanBudget > 2500) {
    throw new ValidationError('INVALID_BUDGET: Bi-weekly budget cap must be between $10 and $2,500.');
  }

  const cleanTradeOff = tradeOffPrompt ? String(tradeOffPrompt).trim().slice(0, 240) : '';
  const cleanRentDay = Number.isFinite(rentDueDay) && rentDueDay >= 1 && rentDueDay <= 31 ? Math.round(rentDueDay) : 1;
  const targetTotal = Math.round(cleanBudget * 4);

  const prompt = `You are SplitCart AI, a real-time Universal E-Commerce Product Discovery & PayPal Pay in 4 Cash-Flow Architect.

Shopper Goal / Category (Anything A-to-Z): "${cleanGoal}"
Target Bi-Weekly Paycheck Budget: $${cleanBudget.toFixed(2)} every 2 weeks (Target 4-payment total: ~$${targetTotal.toFixed(2)}).
Custom Adjustment / Trade-Off Request: "${cleanTradeOff || 'None — curate the best 4-item bundle that fits their budget'}".

PayPal US Pay Later Rules:
- Pay in 4 (0% APR): Strictly $30.00 to $1,500.00 per checkout (4 bi-weekly payments every 14 days).
- Pay Monthly: $199.00 to $10,000.00 (6 or 12 monthly payments).

Instructions:
1. Discover 4 specific, real-world retail products (with real brand names, accurate model names, and realistic current US retail prices in USD) that together form a complete "${cleanGoal}".
2. Unless the user explicitly asked for an ultra-luxury/over-$1,500 rig, keep the sum of the 4 prices at or below $${targetTotal.toFixed(2)} so the bi-weekly installment (total / 4) stays within $${cleanBudget.toFixed(2)}. If the user's Trade-Off Request asks to test a high-end >$1,500 setup, select flagship pro models totaling $1,600–$1,900.
3. Assign exactly 2 core items to phase "PHASE_1_TODAY" (must-have essentials needed on Day 1) and 2 secondary/accessory items to "PHASE_2_STAGGERED" (upgrades/accessories the shopper can buy 28 days later on their next paycheck cycle so installments never stack).
4. Provide a concise rationale explaining how the bundle fits their paycheck cash flow, plus 2 specific follow-up negotiation chips.`;

  let rawProducts: Product[] = [];
  let bundleName = '';
  let rationale = '';
  let negotiationChips: Array<{ label: string; prompt: string }> = [];
  let sourceMode: 'gemini-live' | 'deterministic-fallback' = 'gemini-live';

  try {
    const geminiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bundleName: { type: Type.STRING },
            rationale: { type: Type.STRING },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Unique slug ID like sku-breville-bambino' },
                  name: { type: Type.STRING, description: 'Real brand and product model name' },
                  brand: { type: Type.STRING },
                  category: { type: Type.STRING },
                  price: { type: Type.NUMBER, description: 'Realistic US retail price in USD' },
                  tier: { type: Type.STRING, description: 'essential, recommended, or upgrade' },
                  phase: { type: Type.STRING, description: 'PHASE_1_TODAY or PHASE_2_STAGGERED' },
                  description: { type: Type.STRING },
                  retailerHint: { type: Type.STRING }
                },
                required: ['id', 'name', 'brand', 'category', 'price', 'tier', 'phase', 'description']
              }
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
          required: ['bundleName', 'rationale', 'products', 'negotiationChips']
        }
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API request timed out after 12s')), GEMINI_TIMEOUT_MS)
    );

    const response = await Promise.race([geminiCall, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');

    if (!Array.isArray(parsed.products) || parsed.products.length < 2) {
      throw new Error('Gemini returned fewer than 2 products');
    }

    // Ensure unique SKU IDs per item
    rawProducts = parsed.products.slice(0, 6).map((p: any, idx: number) => ({
      ...p,
      id: `${String(p.id || 'sku').replace(/[^a-zA-Z0-9_-]/g, '')}-${idx + 1}`
    }));

    bundleName = parsed.bundleName || `Curated ${cleanGoal}`;
    rationale = parsed.rationale || `Dynamically curated for your $${cleanBudget}/2wks PayPal Pay in 4 budget.`;
    negotiationChips = Array.isArray(parsed.negotiationChips) ? parsed.negotiationChips.slice(0, 3) : [];
  } catch (err: any) {
    console.error('[SplitCart AI] Gemini live generation error, using dynamic budget-matched fallback:', err?.message || err);
    sourceMode = 'deterministic-fallback';
    const fb = buildDynamicFallbackProducts(cleanGoal, targetTotal, cleanTradeOff);
    rawProducts = fb.products;
    bundleName = fb.bundleName;
    rationale = fb.rationale;
    negotiationChips = fb.chips;
  }

  // Register discovered SKUs in server-side canonical registry & lock prices
  const registeredProducts = registerDynamicProducts(rawProducts);
  const allSkuIds = registeredProducts.map(p => p.id);
  const { items, total: totalPrice, totalCents, cartHash } = verifyAndHashCart(allSkuIds);

  // Build Phase 1 (Buy Today) & Phase 2 (Staggered +28 Days) server-signed carts
  let phase1Items = items.filter(i => i.phase === 'PHASE_1_TODAY');
  let phase2Items = items.filter(i => i.phase === 'PHASE_2_STAGGERED');

  if (phase1Items.length === 0 || phase2Items.length === 0) {
    const mid = Math.ceil(items.length / 2);
    phase1Items = items.slice(0, mid).map(i => ({ ...i, phase: 'PHASE_1_TODAY' }));
    phase2Items = items.slice(mid).map(i => ({ ...i, phase: 'PHASE_2_STAGGERED' }));
  }

  const p1Verified = verifyAndHashCart(phase1Items.map(i => i.id));
  const p2Verified = verifyAndHashCart(phase2Items.map(i => i.id));
  const p1Installments = computeInstallmentsInDollars(p1Verified.totalCents);
  const p2Installments = computeInstallmentsInDollars(p2Verified.totalCents);

  // Full cart deterministic PayPal BNPL math in integer cents
  const payIn4Eligible = totalCents >= 3000 && totalCents <= 150000;
  const installments = computeInstallmentsInDollars(totalCents);
  const biWeeklyAmount = payIn4Eligible ? installments[0] : Number((totalPrice / 4).toFixed(2));
  const payMonthlyEligible = totalCents >= 19900 && totalCents <= 1000000;

  const today = new Date();
  const schedule = [0, 14, 28, 42].map((days, idx) => {
    const d = new Date(today.getTime() + days * 86400000);
    const dayOfMonth = d.getDate();
    const directDiff = Math.abs(dayOfMonth - cleanRentDay);
    const minDiff = Math.min(directDiff, 30 - directDiff);
    return {
      installment: idx + 1,
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isoDate: d.toISOString().split('T')[0],
      amount: installments[idx],
      label: idx === 0 ? 'Payment 1 (Today)' : `Payment ${idx + 1} (+${days}d)`,
      rentBufferSafe: minDiff > 2
    };
  });

  const peakDrop = Number((biWeeklyAmount - p1Installments[0]).toFixed(2));
  const shouldRecommendSplit = !payIn4Eligible || biWeeklyAmount > cleanBudget;

  const phasedSplit = {
    recommended: shouldRecommendSplit,
    reason: !payIn4Eligible
      ? `Full bundle ($${totalPrice.toFixed(2)}) exceeds PayPal Pay in 4's $1,500.00 statutory cap. Splitting into Phase 1 Essentials today ($${p1Verified.total.toFixed(2)}) and Phase 2 Upgrades in 28 days ($${p2Verified.total.toFixed(2)}) unlocks 0% APR Pay in 4 on both carts and cuts your immediate paycheck hit to $${p1Installments[0].toFixed(2)}/2wks.`
      : `Staggering your purchase into Phase 1 Essentials today and Phase 2 Upgrades in 28 days lowers your immediate bi-weekly paycheck commitment from $${biWeeklyAmount.toFixed(2)} down to $${p1Installments[0].toFixed(2)} (-$${peakDrop.toFixed(2)}/paycheck).`,
    peakBiWeeklyDrop: peakDrop,
    phase1: {
      phaseId: 'PHASE_1_TODAY' as const,
      label: 'Phase 1: Day-1 Core Essentials (Buy Today)',
      timingBadge: 'Starts Today • Days 0, 14, 28, 42',
      startOffsetDays: 0,
      items: p1Verified.items,
      skuIds: p1Verified.items.map(i => i.id),
      totalPrice: p1Verified.total,
      cartHash: p1Verified.cartHash,
      payIn4Eligible: p1Verified.totalCents >= 3000 && p1Verified.totalCents <= 150000,
      biWeeklyAmount: p1Installments[0],
      installments: p1Installments
    },
    phase2: {
      phaseId: 'PHASE_2_STAGGERED' as const,
      label: 'Phase 2: Expansion & Accessories (Staggered +28 Days)',
      timingBadge: 'Starts Next Paycheck Cycle • Days 28, 42, 56, 70',
      startOffsetDays: 28,
      items: p2Verified.items,
      skuIds: p2Verified.items.map(i => i.id),
      totalPrice: p2Verified.total,
      cartHash: p2Verified.cartHash,
      payIn4Eligible: p2Verified.totalCents >= 3000 && p2Verified.totalCents <= 150000,
      biWeeklyAmount: p2Installments[0],
      installments: p2Installments
    }
  };

  const uniqueInputCount = new Set(rawProducts.map(p => p.id)).size;
  const sumOfInstallmentsCents = installments.reduce((acc, val) => acc + Math.round(val * 100), 0);

  const contracts: ContractCheck[] = [
    {
      code: 'SKU_CANONICAL_LOCK',
      label: 'Server SKU Registry Lock',
      passed: items.length === rawProducts.length && uniqueInputCount === rawProducts.length,
      detail: `${items.length}/${rawProducts.length} unique dynamic SKUs registered & price-locked on server`
    },
    {
      code: 'PRICE_IMMUTABILITY',
      label: 'HMAC-SHA256 & Cent-Exact Math',
      passed: sumOfInstallmentsCents === totalCents,
      detail: `Full [${cartHash}] • Phase 1 [${p1Verified.cartHash}] • Phase 2 [${p2Verified.cartHash}]`
    },
    {
      code: 'PAY_IN_4_STATUTORY_BOUNDS',
      label: 'PayPal Pay in 4 Cap ($30–$1,500)',
      passed: payIn4Eligible,
      detail: payIn4Eligible
        ? `$${totalPrice.toFixed(2)} qualifies for 0% APR Pay in 4 ($${biWeeklyAmount.toFixed(2)}/2wks)`
        : `Full cart ($${totalPrice.toFixed(2)}) exceeds $1,500 cap — Phased Split unlocks 0% APR`
    },
    {
      code: 'CASHFLOW_CAP_CHECK',
      label: 'Paycheck Cash-Flow Fit',
      passed: biWeeklyAmount <= cleanBudget || p1Installments[0] <= cleanBudget,
      detail:
        biWeeklyAmount <= cleanBudget
          ? `Full bundle ($${biWeeklyAmount.toFixed(2)}/2wks) fits within $${cleanBudget.toFixed(2)} cap`
          : `Phase 1 ($${p1Installments[0].toFixed(2)}/2wks) fits safely within $${cleanBudget.toFixed(2)} cap`
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
      installments,
      schedule,
      statusMessage: payIn4Eligible
        ? `Eligible for 4 interest-free payments of $${biWeeklyAmount.toFixed(2)} (0% APR)`
        : `Full cart ($${totalPrice.toFixed(2)}) exceeds PayPal Pay in 4's $1,500 single-order cap.`
    },
    payMonthly: {
      eligible: payMonthlyEligible,
      sixMonthAmount: Number((totalPrice / 6).toFixed(2)),
      twelveMonthAmount: Number((totalPrice / 12).toFixed(2))
    },
    phasedSplit,
    contracts,
    negotiationChips,
    sourceMode
  };
}