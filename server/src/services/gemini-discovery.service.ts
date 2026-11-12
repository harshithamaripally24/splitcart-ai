import { GoogleGenAI, Type } from '@google/genai';
import { ENV } from '../config/env.config';
import { Product } from '../types/commerce.types';

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = 12000;

interface CatalogItemTemplate {
  name: string;
  brand: string;
  category: string;
  weight: number;
  tier: 'essential' | 'recommended' | 'upgrade';
  phase: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  description: string;
}

interface CuratedCatalogTemplate {
  keywords: string[];
  bundleName: string;
  items: CatalogItemTemplate[];
}

const REAL_RETAIL_TEMPLATES: CuratedCatalogTemplate[] = [
  {
    keywords: ['espresso', 'coffee', 'matcha', 'cafe', 'barista', 'latte', 'grinder'],
    bundleName: 'Artisan Home Espresso & Matcha Bar',
    items: [
      {
        name: 'Breville Bambino Plus Espresso Machine',
        brand: 'Breville',
        category: 'Espresso Machine',
        weight: 0.48,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '3-second ThermoJet heat-up with automatic microfoam milk texturing wand'
      },
      {
        name: 'Baratza Encore ESP Conical Burr Grinder',
        brand: 'Baratza',
        category: 'Coffee Grinder',
        weight: 0.28,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '40-step high-precision grind adjustment engineered for espresso and pour-over'
      },
      {
        name: 'Timemore Black Mirror Nano Espresso Scale',
        brand: 'Timemore',
        category: 'Precision Scale',
        weight: 0.13,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '0.1g accuracy with auto-timer and flow-rate tracking for dial-in consistency'
      },
      {
        name: 'Fellow Eddy Steaming Pitcher & WDT Tamper Kit',
        brand: 'Fellow',
        category: 'Barista Tools',
        weight: 0.11,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: '304 stainless steel fluted spout pitcher with calibrated spring tamper'
      }
    ]
  },
  {
    keywords: [
      'camp',
      'tent',
      'outdoor',
      'hiking',
      'backpacking',
      'spur',
      'agnes',
      'therm-a-rest',
      'neoair',
      'jetboil',
      'black diamond',
      'headlamp',
      'sleeping pad'
    ],
    bundleName: 'Ultralight 2-Person Backcountry Camping Kit',
    items: [
      {
        name: 'Big Agnes Copper Spur HV UL2 Tent',
        brand: 'Big Agnes',
        category: 'Shelter',
        weight: 0.45,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Freestanding 3-season ultralight double-wall tent with dual vestibules'
      },
      {
        name: 'Therm-a-Rest NeoAir XLite NXT Sleeping Pad',
        brand: 'Therm-a-Rest',
        category: 'Sleep System',
        weight: 0.28,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '4.5 R-value insulated air pad weighing just 13 oz for cold nights'
      },
      {
        name: 'Jetboil Flash 1.0L Fast Boil Cooking System',
        brand: 'Jetboil',
        category: 'Camp Kitchen',
        weight: 0.16,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Boils 16 oz of water in 100 seconds with integrated FluxRing heat exchanger'
      },
      {
        name: 'Black Diamond Spot 400-R Rechargeable Headlamp',
        brand: 'Black Diamond',
        category: 'Lighting & Safety',
        weight: 0.11,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: 'IP67 waterproof 400-lumen trail headlamp with red night-vision mode'
      }
    ]
  },
  {
    keywords: ['baby', 'nursery', 'newborn', 'crib', 'monitor', 'babyletto', 'nanit', 'newton', 'hatch', 'stroller'],
    bundleName: 'Smart Newborn Nursery & Sleep Safety Setup',
    items: [
      {
        name: 'Babyletto Hudson 3-in-1 Convertible Crib',
        brand: 'Babyletto',
        category: 'Nursery Furniture',
        weight: 0.44,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'GREENGUARD Gold certified sustainable pine crib with toddler bed conversion kit'
      },
      {
        name: 'Newton Baby Breathable Wovenaire Crib Mattress',
        brand: 'Newton Baby',
        category: 'Sleep Safety',
        weight: 0.28,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '100% washable, hypoallergenic Dual-Stage air-core mattress for infant and toddler'
      },
      {
        name: 'Nanit Pro Smart Baby Monitor & Wall Mount',
        brand: 'Nanit',
        category: 'Safety Tech',
        weight: 0.18,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '1080p HD overhead camera with sensor-free breathing motion and sleep analytics'
      },
      {
        name: 'Hatch Rest+ 2nd Gen Smart Sound Machine',
        brand: 'Hatch',
        category: 'Sleep Aid',
        weight: 0.10,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: 'Wi-Fi white noise machine, nightlight, and time-to-rise sleep trainer'
      }
    ]
  },
  {
    keywords: ['gym', 'fitness', 'dumbbell', 'workout', 'cardio', 'bowflex', 'bench', 'manduka', 'theragun', 'weights'],
    bundleName: 'Compact Apartment Strength & HIIT Home Gym',
    items: [
      {
        name: 'Bowflex SelectTech 552 Adjustable Dumbbells (Pair)',
        brand: 'Bowflex',
        category: 'Strength Equipment',
        weight: 0.46,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Replaces 15 sets of weights (5 to 52.5 lbs) with rapid turn-dial selection'
      },
      {
        name: 'REP Fitness AB-3100 Adjustable Weight Bench',
        brand: 'REP Fitness',
        category: 'Strength Bench',
        weight: 0.27,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '700 lb capacity 6-position FID bench for compact apartment workouts'
      },
      {
        name: 'Manduka PRO 6mm High-Density Exercise Mat',
        brand: 'Manduka',
        category: 'Flooring & Mobility',
        weight: 0.15,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Ultra-dense closed-cell cushioning for joint protection and noise dampening'
      },
      {
        name: 'Theragun Relief Percussive Therapy Massager',
        brand: 'Therabody',
        category: 'Recovery',
        weight: 0.12,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: '16mm amplitude deep muscle recovery gun with 3 specialized attachments'
      }
    ]
  },
  {
    keywords: ['video', 'camera', 'podcast', 'cinema', 'studio', '4k', 'sony', 'fx30', 'sigma', 'shure', 'aputure'],
    bundleName: '4K Creator Cinema & Podcast Production Studio',
    items: [
      {
        name: 'Sony FX30 Digital Cinema Camera Body',
        brand: 'Sony',
        category: 'Cinema Camera',
        weight: 0.48,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Super 35 back-illuminated APS-C CMOS sensor with 10-bit 4:2:2 4K120p recording'
      },
      {
        name: 'Sigma 18-50mm f/2.8 DC DN Contemporary Lens',
        brand: 'Sigma',
        category: 'Camera Optics',
        weight: 0.26,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Constant f/2.8 aperture zoom lens for razor-sharp studio and handheld video'
      },
      {
        name: 'Shure SM7dB Dynamic Vocal Microphone',
        brand: 'Shure',
        category: 'Studio Audio',
        weight: 0.16,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Broadcast-standard dynamic XLR microphone with built-in +28dB active preamp'
      },
      {
        name: 'Aputure Amaran 200x S Bi-Color LED Key Light',
        brand: 'Aputure',
        category: 'Studio Lighting',
        weight: 0.10,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: '200W dual-blue LED point-source video light with ultra-high SSI color accuracy'
      }
    ]
  },
  {
    keywords: ['office', 'desk', 'monitor', 'ergonomic', 'engineer', 'laptop', 'dell', 'keychron', 'keyboard', 'logitech', 'benq'],
    bundleName: 'Ergonomic Software Engineer Home Office Setup',
    items: [
      {
        name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor (U2723QE)',
        brand: 'Dell',
        category: 'Display',
        weight: 0.44,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'IPS Black panel with 90W USB-C power delivery and built-in RJ45 Ethernet hub'
      },
      {
        name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
        brand: 'Keychron',
        category: 'Input Devices',
        weight: 0.26,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Full CNC machined aluminum body with QMK/VIA support and tactile switches'
      },
      {
        name: 'Logitech MX Master 3S Wireless Performance Mouse',
        brand: 'Logitech',
        category: 'Ergonomics',
        weight: 0.16,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '8K DPI optical sensor with MagSpeed electromagnetic scrolling and quiet clicks'
      },
      {
        name: 'BenQ ScreenBar Halo LED Monitor Light Bar',
        brand: 'BenQ',
        category: 'Task Lighting',
        weight: 0.14,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: 'Zero-glare asymmetrical optical design with wireless backlight rotary controller'
      }
    ]
  }
];

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
  const cleanGoal = userGoal.trim() || 'Craft Home Espresso & Matcha Bar Setup';
  const searchTerms = `${cleanGoal} ${tradeOffPrompt || ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2);
  const fullLower = `${cleanGoal} ${tradeOffPrompt || ''}`.toLowerCase();

  const isOver1500 = fullLower.includes('cinema') || fullLower.includes('4k') || fullLower.includes('studio');
  let effectiveTotal = isOver1500 ? 1680 : 540;

  if (fullLower.includes('15%') || fullLower.includes('cheaper') || fullLower.includes('reduce')) {
    effectiveTotal = Math.round(effectiveTotal * 0.85);
  } else if (fullLower.includes('upgrade') || fullLower.includes('flagship')) {
    effectiveTotal = Math.round(effectiveTotal * 1.15);
  }

  // Score every template by checking keywords AND every item's name, brand, category, and description
  let bestTemplate: CuratedCatalogTemplate | null = null;
  let bestScore = 0;

  for (const tpl of REAL_RETAIL_TEMPLATES) {
    const searchableText = [
      tpl.bundleName,
      ...tpl.keywords,
      ...tpl.items.map(i => `${i.name} ${i.brand} ${i.category} ${i.description}`)
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    for (const term of searchTerms) {
      if (searchableText.includes(term)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = tpl;
    }
  }

  const slug = cleanGoal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 16) || 'item';

  // If the user typed a custom product/goal not in the 6 templates, build tailored items for their exact search
  let selectedItems: CatalogItemTemplate[];
  let resolvedBundleName: string;

  if (bestTemplate && bestScore > 0) {
    resolvedBundleName = bestTemplate.bundleName;
    // If they searched for a specific item inside the template (e.g. "Black Diamond" or "Spur HV"), promote it to Phase 1
    const sorted = [...bestTemplate.items].sort((a, b) => {
      const aMatch = searchTerms.some(t => `${a.name} ${a.brand}`.toLowerCase().includes(t)) ? 1 : 0;
      const bMatch = searchTerms.some(t => `${b.name} ${b.brand}`.toLowerCase().includes(t)) ? 1 : 0;
      return bMatch - aMatch;
    });
    selectedItems = sorted.map((item, idx) => ({
      ...item,
      phase: idx < 2 ? 'PHASE_1_TODAY' : 'PHASE_2_STAGGERED'
    }));
  } else {
    const titleGoal = cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1);
    resolvedBundleName = `${titleGoal} — Pay in 4 Shopping Plan`;
    selectedItems = [
      {
        name: `${titleGoal} (Flagship Primary Model)`,
        brand: 'Verified Retail',
        category: 'Primary Item',
        weight: 0.48,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: `Top-rated retail model matching "${cleanGoal}" sized for your Pay in 4 budget`
      },
      {
        name: `${titleGoal} Companion & Protection Pack`,
        brand: 'Essentials',
        category: 'Core Add-On',
        weight: 0.27,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: `Essential companion gear and extended care kit for ${cleanGoal}`
      },
      {
        name: `${titleGoal} Performance Upgrade Kit`,
        brand: 'ProLine',
        category: 'Upgrade',
        weight: 0.15,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: `Staggered Phase 2 upgrade scheduled for your next paycheck cycle (+28d)`
      },
      {
        name: `${titleGoal} Travel & Storage Organizer`,
        brand: 'GearCraft',
        category: 'Accessories',
        weight: 0.10,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: `Protective organizer and everyday maintenance accessories`
      }
    ];
  }

  const p1 = Math.round(effectiveTotal * selectedItems[0].weight);
  const p2 = Math.round(effectiveTotal * selectedItems[1].weight);
  const p3 = Math.round(effectiveTotal * selectedItems[2].weight);
  const p4 = Math.max(19, effectiveTotal - (p1 + p2 + p3));
  const prices = [p1, p2, p3, p4];

  const products: Product[] = selectedItems.map((item, idx) => ({
    id: `sku-${slug}-${idx + 1}`,
    name: item.name,
    brand: item.brand,
    category: item.category,
    price: prices[idx],
    tier: item.tier,
    phase: item.phase,
    description: item.description
  }));

  const total = prices.reduce((a, b) => a + b, 0);
  const biWeekly = (total / 4).toFixed(2);

  return {
    bundleName: resolvedBundleName,
    rationale: `Curated real-world retail items totaling $${total.toFixed(2)} ($${biWeekly} every 2 weeks across 4 payments). Click any card below to customize your bag or split across paychecks.`,
    products,
    chips: [
      {
        label: `Value Tier (-15% • ~$${Math.round((total * 0.85) / 4)}/2wks)`,
        prompt: `Swap to value-tier models to reduce total cost by 15%`
      },
      {
        label: `Pro Upgrade (+15% • ~$${Math.round((total * 1.15) / 4)}/2wks)`,
        prompt: `Upgrade primary anchor item to a flagship pro model`
      }
    ]
  };
}

async function callGeminiModel(modelName: string, prompt: string) {
  const geminiCall = ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
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
    setTimeout(() => reject(new Error(`Gemini timeout on ${modelName}`)), GEMINI_TIMEOUT_MS)
  );

  return Promise.race([geminiCall, timeoutPromise]);
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
  if (!ENV.GEMINI_API_KEY) {
    const fb = buildDynamicFallbackProducts(cleanGoal, targetTotal, cleanTradeOff);
    return {
      bundleName: fb.bundleName,
      rationale: fb.rationale,
      rawProducts: fb.products,
      negotiationChips: fb.chips,
      sourceMode: 'deterministic-fallback'
    };
  }

  const prompt = `You are SplitCart AI, a consumer shopping assistant and PayPal Pay in 4 planner.
Shopper Search / Goal: "${cleanGoal}"
Target Bi-Weekly Budget: $${cleanBudget.toFixed(2)} every 2 weeks (Target total cart: ~$${targetTotal.toFixed(2)}).
Custom Request: "${cleanTradeOff || 'Recommend the best real-world retail items'}".

Instructions:
1. Recommend 4 specific, real-world retail products with authentic brand names and specific model names that match "${cleanGoal}". If "${cleanGoal}" is a specific product or brand (like "Black Diamond" or "Big Agnes Copper Spur"), make that exact product Item #1 and pair it with 3 matching companion items.
2. Use realistic MSRP price estimates for each product; do not artificially inflate prices just to fill the budget cap.
3. Mark the 2 most important items as phase "PHASE_1_TODAY" (Buy Today) and the 2 secondary/accessory items as "PHASE_2_STAGGERED" (Next Paycheck +28d).
4. Provide a concise shopper rationale and 2 helpful price/model swap chips.`;

  try {
    let response;
    try {
      response = await callGeminiModel('gemini-3.8-flash', prompt);
    } catch {
      response = await callGeminiModel('gemini-2.5-flash', prompt);
    }

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
      rationale: parsed.rationale || `Curated for your $${cleanBudget}/2wks PayPal Pay in 4 budget.`,
      rawProducts,
      negotiationChips: Array.isArray(parsed.negotiationChips) ? parsed.negotiationChips.slice(0, 3) : [],
      sourceMode: 'gemini-live'
    };
  } catch (err: any) {
    console.error('[GeminiDiscoveryService] Using curated retail catalog:', err?.message || err);
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