import { GoogleGenAI, Type } from '@google/genai';
import { ENV } from '../config/env.config';
import { Product } from '../types/commerce.types';

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = 10000;

interface CatalogItemTemplate {
  name: string;
  brand: string;
  category: string;
  basePrice: number;
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
    keywords: ['espresso', 'coffee', 'matcha', 'cafe', 'barista', 'latte', 'grinder', 'breville', 'baratza'],
    bundleName: 'Artisan Home Espresso & Matcha Bar',
    items: [
      {
        name: 'Breville Bambino Plus Espresso Machine',
        brand: 'Breville',
        category: 'Espresso Machine',
        basePrice: 299.95,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '3-second ThermoJet heat-up with automatic microfoam milk texturing wand'
      },
      {
        name: 'Baratza Encore ESP Conical Burr Grinder',
        brand: 'Baratza',
        category: 'Coffee Grinder',
        basePrice: 199.95,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '40-step high-precision grind adjustment engineered for espresso and pour-over'
      },
      {
        name: 'Timemore Black Mirror Nano Espresso Scale',
        brand: 'Timemore',
        category: 'Precision Scale',
        basePrice: 69.00,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '0.1g accuracy with auto-timer and flow-rate tracking for dial-in consistency'
      },
      {
        name: 'Fellow Eddy Steaming Pitcher & WDT Tamper Kit',
        brand: 'Fellow',
        category: 'Barista Tools',
        basePrice: 55.00,
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
        basePrice: 229.95,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Freestanding 3-season ultralight double-wall tent with dual vestibules'
      },
      {
        name: 'Therm-a-Rest NeoAir XLite NXT Sleeping Pad',
        brand: 'Therm-a-Rest',
        category: 'Sleep System',
        basePrice: 149.95,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '4.5 R-value insulated air pad weighing just 13 oz for cold nights'
      },
      {
        name: 'Jetboil Flash 1.0L Fast Boil Cooking System',
        brand: 'Jetboil',
        category: 'Camp Kitchen',
        basePrice: 89.95,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Boils 16 oz of water in 100 seconds with integrated FluxRing heat exchanger'
      },
      {
        name: 'Black Diamond Spot 400-R Rechargeable Headlamp',
        brand: 'Black Diamond',
        category: 'Lighting & Safety',
        basePrice: 49.95,
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: 'IP67 waterproof 400-lumen trail headlamp with red night-vision mode'
      }
    ]
  },
  {
    keywords: ['baby', 'nursery', 'newborn', 'crib', 'monitor', 'babyletto', 'nanit', 'newton', 'hatch', 'mattress'],
    bundleName: 'Smart Newborn Nursery & Sleep Safety Setup',
    items: [
      {
        name: 'Babyletto Hudson 3-in-1 Convertible Crib',
        brand: 'Babyletto',
        category: 'Nursery Furniture',
        basePrice: 299.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'GREENGUARD Gold certified sustainable pine crib with toddler bed conversion kit'
      },
      {
        name: 'Newton Baby Breathable Wovenaire Crib Mattress',
        brand: 'Newton Baby',
        category: 'Sleep Safety',
        basePrice: 189.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '100% washable, hypoallergenic Dual-Stage air-core mattress for infant and toddler'
      },
      {
        name: 'Nanit Pro Smart Baby Monitor & Wall Mount',
        brand: 'Nanit',
        category: 'Safety Tech',
        basePrice: 139.00,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '1080p HD overhead camera with sensor-free breathing motion and sleep analytics'
      },
      {
        name: 'Hatch Rest+ 2nd Gen Smart Sound Machine',
        brand: 'Hatch',
        category: 'Sleep Aid',
        basePrice: 59.99,
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
        basePrice: 279.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Replaces 15 sets of weights (5 to 52.5 lbs) with rapid turn-dial selection'
      },
      {
        name: 'REP Fitness AB-3100 Adjustable Weight Bench',
        brand: 'REP Fitness',
        category: 'Strength Bench',
        basePrice: 169.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: '700 lb capacity 6-position FID bench for compact apartment workouts'
      },
      {
        name: 'Manduka PRO 6mm High-Density Exercise Mat',
        brand: 'Manduka',
        category: 'Flooring & Mobility',
        basePrice: 78.00,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Ultra-dense closed-cell cushioning for joint protection and noise dampening'
      },
      {
        name: 'Theragun Relief Percussive Therapy Massager',
        brand: 'Therabody',
        category: 'Recovery',
        basePrice: 69.00,
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
        basePrice: 799.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Super 35 back-illuminated APS-C CMOS sensor with 10-bit 4:2:2 4K120p recording'
      },
      {
        name: 'Sigma 18-50mm f/2.8 DC DN Contemporary Lens',
        brand: 'Sigma',
        category: 'Camera Optics',
        basePrice: 429.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Constant f/2.8 aperture zoom lens for razor-sharp studio and handheld video'
      },
      {
        name: 'Shure SM7dB Dynamic Vocal Microphone',
        brand: 'Shure',
        category: 'Studio Audio',
        basePrice: 279.00,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Broadcast-standard dynamic XLR microphone with built-in +28dB active preamp'
      },
      {
        name: 'Aputure Amaran 200x S Bi-Color LED Key Light',
        brand: 'Aputure',
        category: 'Studio Lighting',
        basePrice: 179.00,
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
        basePrice: 249.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'IPS Black panel with 90W USB-C power delivery and built-in RJ45 Ethernet hub'
      },
      {
        name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
        brand: 'Keychron',
        category: 'Input Devices',
        basePrice: 149.00,
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Full CNC machined aluminum body with QMK/VIA support and tactile switches'
      },
      {
        name: 'Logitech MX Master 3S Wireless Performance Mouse',
        brand: 'Logitech',
        category: 'Ergonomics',
        basePrice: 89.00,
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: '8K DPI optical sensor with MagSpeed electromagnetic scrolling and quiet clicks'
      },
      {
        name: 'BenQ ScreenBar Halo LED Monitor Light Bar',
        brand: 'BenQ',
        category: 'Task Lighting',
        basePrice: 69.00,
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
  const searchTerms = (cleanGoal + ' ' + (tradeOffPrompt || ''))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2);
  const tradeLower = (tradeOffPrompt || '').toLowerCase();

  let tierMultiplier = 1.0;
  if (
    tradeLower.includes('value') ||
    tradeLower.includes('cheaper') ||
    tradeLower.includes('15%') ||
    tradeLower.includes('reduce') ||
    tradeLower.includes('under')
  ) {
    tierMultiplier = 0.85;
  } else if (tradeLower.includes('pro') || tradeLower.includes('upgrade') || tradeLower.includes('flagship')) {
    tierMultiplier = 1.15;
  }

  let bestTemplate: CuratedCatalogTemplate | null = null;
  let bestScore = 0;

  for (const tpl of REAL_RETAIL_TEMPLATES) {
    const searchableText = [
      tpl.bundleName,
      ...tpl.keywords,
      ...tpl.items.map(i => i.name + ' ' + i.brand + ' ' + i.category + ' ' + i.description)
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

  const slug = cleanGoal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14) || 'item';
  let selectedItems: CatalogItemTemplate[];
  let resolvedBundleName: string;

  if (bestTemplate && bestScore > 0) {
    resolvedBundleName = bestTemplate.bundleName;
    const sorted = [...bestTemplate.items].sort((a, b) => {
      const aMatch = searchTerms.some(t => (a.name + ' ' + a.brand).toLowerCase().includes(t)) ? 1 : 0;
      const bMatch = searchTerms.some(t => (b.name + ' ' + b.brand).toLowerCase().includes(t)) ? 1 : 0;
      return bMatch - aMatch;
    });
    selectedItems = sorted.map((item, idx) => ({
      ...item,
      phase: idx < 2 ? 'PHASE_1_TODAY' : 'PHASE_2_STAGGERED'
    }));
  } else {
    const titleGoal = cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1);
    const customBudgetTotal = Math.max(120, Math.min(2000, Math.round(targetTotal * 0.9)));
    resolvedBundleName = titleGoal + ' - PayPal Pay in 4 Plan';
    selectedItems = [
      {
        name: titleGoal + ' (Primary Essential Model)',
        brand: 'Demo Catalog',
        category: 'Primary Essential',
        basePrice: Math.round(customBudgetTotal * 0.46),
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Core essential model for ' + cleanGoal
      },
      {
        name: titleGoal + ' Core Companion Kit',
        brand: 'Demo Catalog',
        category: 'Core Add-On',
        basePrice: Math.round(customBudgetTotal * 0.28),
        tier: 'essential',
        phase: 'PHASE_1_TODAY',
        description: 'Required day-one companion kit for ' + cleanGoal
      },
      {
        name: titleGoal + ' Secondary Upgrade',
        brand: 'Demo Catalog',
        category: 'Upgrade',
        basePrice: Math.round(customBudgetTotal * 0.16),
        tier: 'recommended',
        phase: 'PHASE_2_STAGGERED',
        description: 'Optional upgrade that can wait for your next paycheck (+28d)'
      },
      {
        name: titleGoal + ' Care & Organizer Kit',
        brand: 'Demo Catalog',
        category: 'Accessories',
        basePrice: Math.max(19, Math.round(customBudgetTotal * 0.10)),
        tier: 'upgrade',
        phase: 'PHASE_2_STAGGERED',
        description: 'Protective storage and everyday maintenance extras'
      }
    ];
  }

  const products: Product[] = selectedItems.map((item, idx) => {
    const finalPrice = Number((item.basePrice * tierMultiplier).toFixed(2));
    const priceCents = Math.round(finalPrice * 100);
    return {
      id: 'sku-' + slug + '-' + (idx + 1) + '-' + priceCents,
      name: item.name,
      brand: item.brand,
      category: item.category,
      price: finalPrice,
      tier: item.tier,
      phase: item.phase,
      description: item.description
    };
  });

  const total = products.reduce((sum, p) => sum + p.price, 0);
  const biWeekly = (total / 4).toFixed(2);

  return {
    bundleName: resolvedBundleName,
    rationale:
      'Prioritized into Day-1 Essentials first and optional Extras second (Est. $' +
      total.toFixed(2) +
      ' total, 4 bi-weekly PayPal Pay in 4 installments of $' +
      biWeekly +
      ').',
    products,
    chips: [
      {
        label: 'Value Tier (-15% ~ $' + Math.round((total * 0.85) / 4) + '/2wks)',
        prompt: 'Swap to value-tier models to reduce total cost by 15%'
      },
      {
        label: 'Pro Upgrade (+15% ~ $' + Math.round((total * 1.15) / 4) + '/2wks)',
        prompt: 'Upgrade primary anchor item to a flagship pro model'
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
    setTimeout(() => reject(new Error('Gemini timeout on ' + modelName)), GEMINI_TIMEOUT_MS)
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

  const prompt = [
    'You are SplitCart AI, a consumer shopping assistant and PayPal Pay in 4 cash-flow planner.',
    'Shopper Search / Goal: "' + cleanGoal + '"',
    '2-Week Paycheck Comfort Cap: $' + cleanBudget.toFixed(2) + ' every 2 weeks (Max 4-payment cap: $' + targetTotal.toFixed(2) + ').',
    'Custom Request: "' + (cleanTradeOff || 'Recommend essentials first, then extras') + '".',
    '',
    'Instructions:',
    '1. Recommend 4 real-world retail products with authentic brand names and realistic MSRP price estimates matching "' + cleanGoal + '".',
    '2. Use realistic MSRP estimates; do not artificially inflate prices just to fill the cap. Ensure dependencies make sense (e.g., a crib needs a mattress in Phase 1).',
    '3. Mark the 2 most essential items as phase "PHASE_1_TODAY" and tier "essential", and the 2 secondary items as "PHASE_2_STAGGERED" and tier "recommended".',
    '4. Provide a concise shopper rationale and 2 helpful price/model swap chips.'
  ].join('\n');

  try {
    const response = await callGeminiModel('gemini-3.8-flash', prompt);
    const parsed = JSON.parse(response.text || '{}');

    if (!Array.isArray(parsed.products) || parsed.products.length < 2) {
      throw new Error('Gemini returned fewer than 2 products');
    }

    const rawProducts: Product[] = parsed.products.slice(0, 4).map((p: any, idx: number) => {
      const cleanPrice = Number(Math.max(10, Number(p.price) || 49).toFixed(2));
      const priceCents = Math.round(cleanPrice * 100);
      const baseId = String(p.id || 'sku').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28);
      return {
        ...p,
        id: baseId + '-' + (idx + 1) + '-' + priceCents,
        price: cleanPrice
      };
    });

    return {
      bundleName: parsed.bundleName || ('Curated ' + cleanGoal),
      rationale: parsed.rationale || ('Prioritized for your $' + cleanBudget + '/2wks PayPal Pay in 4 cap.'),
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