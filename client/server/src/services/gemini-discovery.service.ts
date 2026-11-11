import { GoogleGenAI, Type } from '@google/genai';
import { ENV } from '../config/env.config';
import { Product } from '../types/commerce.types';

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = 12000;

export function buildDynamicFallbackProducts(
  userGoal: string,
  targetTotal: number,
  tradeOffPrompt?: string
): {
  bundleName: string;
  rationale: string;
  products: Product[];
  chips: Array<{ label: string; prompt: string }>;
} {
  const cleanGoal = userGoal.trim() || 'Smart Lifestyle Bundle';
  const clampedTotal = Math.max(120, Math.min(2400, targetTotal));
  const p1 = Math.round(clampedTotal * 0.42);
  const p2 = Math.round(clampedTotal * 0.30);
  const p3 = Math.round(clampedTotal * 0.16);
  const p4 = Math.max(15, clampedTotal - (p1 + p2 + p3));
  const slug = cleanGoal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18) || 'bundle';

  const products: Product[] = [
    {
      id: `sku-${slug}-core-1`,
      name: `${cleanGoal} — Primary Anchor System`,
      brand: 'ProSeries',
      category: 'Essential Hardware',
      price: p1,
      tier: 'essential',
      phase: 'PHASE_1_TODAY',
      description: `Primary anchor component for ${cleanGoal}`
    },
    {
      id: `sku-${slug}-core-2`,
      name: `${cleanGoal} — Companion Essential Unit`,
      brand: 'ErgoCraft',
      category: 'Core Companion',
      price: p2,
      tier: 'essential',
      phase: 'PHASE_1_TODAY',
      description: `Core secondary item needed on Day 1`
    },
    {
      id: `sku-${slug}-acc-3`,
      name: `${cleanGoal} — Performance Upgrade Module`,
      brand: 'StudioLine',
      category: 'Upgrade',
      price: p3,
      tier: 'recommended',
      phase: 'PHASE_2_STAGGERED',
      description: `Recommended expansion module for Phase 2`
    },
    {
      id: `sku-${slug}-acc-4`,
      name: `${cleanGoal} — Complete Accessory Kit`,
      brand: 'Essentials+',
      category: 'Accessory Kit',
      price: p4,
      tier: 'upgrade',
      phase: 'PHASE_2_STAGGERED',
      description: `Finishing kit${tradeOffPrompt ? ` (${tradeOffPrompt.slice(0, 40)})` : ''}`
    }
  ];

  const total = p1 + p2 + p3 + p4;
  const biWeekly = (total / 4).toFixed(2);

  return {
    bundleName: `Curated ${cleanGoal}`,
    rationale: `Tailored 4-item bundle totaling $${total.toFixed(2)} ($${biWeekly} every 2 weeks), or split into Phase 1 Essentials today ($${((p1 + p2) / 4).toFixed(2)}/2wks) and Phase 2 Upgrades next month.`,
    products,
    chips: [
      {
        label: `Lower Total by 15% (~$${Math.round((total * 0.85) / 4)}/2wks)`,
        prompt: `Swap to value-tier models to reduce total bundle cost by 15%`
      },
      {
        label: `Upgrade Primary Item (+$${Math.round((total * 0.15) / 4)}/2wks)`,
        prompt: `Upgrade the primary anchor item to a flagship pro model`
      }
    ]
  };
}

export async function discoverProductsWithGemini(
  cleanGoal: string,
  cleanBudget: number,
  targetTotal: number,
  cleanTradeOff: string
): Promise<{
  bundleName: string;
  rationale: string;
  rawProducts: Product[];
  negotiationChips: Array<{ label: string; prompt: string }>;
  sourceMode: 'gemini-live' | 'deterministic-fallback';
}> {
  const prompt = `You are SplitCart AI, a real-time Universal E-Commerce Product Discovery & PayPal Pay in 4 Cash-Flow Planner.
Shopper Goal: "${cleanGoal}"
Target Bi-Weekly Budget: $${cleanBudget.toFixed(2)} every 2 weeks (Target 4-payment total: ~$${targetTotal.toFixed(2)}).
Adjustment Request: "${cleanTradeOff || 'None — curate the best 4-item bundle fitting their budget'}".

Instructions:
1. Discover 4 specific, real-world retail products (with real brand names, model names, and realistic US retail prices in USD) for "${cleanGoal}".
2. Unless the user explicitly asked for an over-$1,500 setup, keep the sum of the 4 prices at or below $${targetTotal.toFixed(2)}.
3. Assign 2 core items to phase "PHASE_1_TODAY" and 2 secondary items to "PHASE_2_STAGGERED".
4. Provide a concise shopper-friendly rationale and 2 follow-up customization chips.`;

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
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  category: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  tier: { type: Type.STRING },
                  phase: { type: Type.STRING },
                  description: { type: Type.STRING }
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

    const rawProducts: Product[] = parsed.products.slice(0, 6).map((p: any, idx: number) => ({
      ...p,
      id: `${String(p.id || 'sku').replace(/[^a-zA-Z0-9_-]/g, '')}-${idx + 1}`
    }));

    return {
      bundleName: parsed.bundleName || `Curated ${cleanGoal}`,
      rationale: parsed.rationale || `Curated for your $${cleanBudget}/2wks budget.`,
      rawProducts,
      negotiationChips: Array.isArray(parsed.negotiationChips) ? parsed.negotiationChips.slice(0, 3) : [],
      sourceMode: 'gemini-live'
    };
  } catch (err: any) {
    console.error('[GeminiDiscoveryService] Fallback activated:', err?.message || err);
    const fb = buildDynamicFallbackProducts(cleanGoal, targetTotal, cleanTradeOff);
    return {
      bundleName: fb.bundleName,
      rationale: fb.rationale,
      rawProducts: fb.products,
      negotiationChips: fb.chips,
      sourceMode: 'deterministic-fallback'
    };
  }
}
