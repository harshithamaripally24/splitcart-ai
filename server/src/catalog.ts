export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  price: number; // Stored in USD, calculated via integer cents
  tier: 'essential' | 'recommended' | 'upgrade';
  phase: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  description: string;
  retailerHint?: string;
}

// Server-side canonical registry for dynamically discovered Gemini SKUs + fallback seeds
const DYNAMIC_SKU_REGISTRY = new Map<string, Product>();

export const SEED_CATALOG: Product[] = [
  {
    id: 'sku-breville-bambino',
    name: 'Breville Bambino Plus Espresso Machine',
    brand: 'Breville',
    category: 'Espresso Machine',
    price: 399.95,
    tier: 'essential',
    phase: 'PHASE_1_TODAY',
    description: 'ThermoJet 3-second heat up with automatic microfoam steam wand',
    retailerHint: 'Specialty Kitchen Retail'
  },
  {
    id: 'sku-baratza-esp',
    name: 'Baratza Encore ESP Conical Burr Grinder',
    brand: 'Baratza',
    category: 'Coffee Grinder',
    price: 199.95,
    tier: 'essential',
    phase: 'PHASE_1_TODAY',
    description: '40-step high-resolution espresso & filter grind adjustment',
    retailerHint: 'Specialty Kitchen Retail'
  },
  {
    id: 'sku-acaia-scale',
    name: 'Timemore Black Mirror Nano Espresso Scale',
    brand: 'Timemore',
    category: 'Barista Precision',
    price: 89.00,
    tier: 'recommended',
    phase: 'PHASE_2_STAGGERED',
    description: '0.1g precision rechargeable scale with auto-tare flow timer',
    retailerHint: 'Coffee Gear Direct'
  },
  {
    id: 'sku-normcore-tamper',
    name: 'Normcore V4 Spring-Loaded 54mm Tamper & WDT Kit',
    brand: 'Normcore',
    category: 'Barista Accessories',
    price: 58.00,
    tier: 'upgrade',
    phase: 'PHASE_2_STAGGERED',
    description: 'Calibrated 30lb pressure tamper with distribution tool',
    retailerHint: 'Coffee Gear Direct'
  }
];

// Initialize registry with seeds
for (const item of SEED_CATALOG) {
  DYNAMIC_SKU_REGISTRY.set(item.id, item);
}

export function registerDynamicProducts(products: Product[]): Product[] {
  const sanitized: Product[] = [];
  for (const p of products) {
    const cleanCents = Math.max(500, Math.min(500000, Math.round(Number(p.price) * 100)));
    const cleanPrice = Number((cleanCents / 100).toFixed(2));
    const item: Product = {
      id: p.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || `sku-${Date.now()}`,
      name: String(p.name || 'Curated Item').slice(0, 120),
      brand: String(p.brand || 'Verified Brand').slice(0, 60),
      category: String(p.category || 'General').slice(0, 50),
      price: cleanPrice,
      tier: ['essential', 'recommended', 'upgrade'].includes(p.tier) ? p.tier : 'recommended',
      phase: p.phase === 'PHASE_2_STAGGERED' ? 'PHASE_2_STAGGERED' : 'PHASE_1_TODAY',
      description: String(p.description || '').slice(0, 200),
      retailerHint: String(p.retailerHint || 'Verified Retail Market Price').slice(0, 60)
    };
    DYNAMIC_SKU_REGISTRY.set(item.id, item);
    sanitized.push(item);
  }
  return sanitized;
}

export function getProductById(id: string): Product | undefined {
  return DYNAMIC_SKU_REGISTRY.get(id);
}

export function getRegistrySize(): number {
  return DYNAMIC_SKU_REGISTRY.size;
}