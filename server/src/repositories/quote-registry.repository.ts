import { Product } from '../types/commerce.types';

const DYNAMIC_SKU_REGISTRY = new Map<string, Product>();

const SEED_PRODUCTS: Product[] = [
  {
    id: 'sku-breville-bambino',
    name: 'Breville Bambino Plus Espresso Machine',
    brand: 'Breville',
    category: 'Espresso Machine',
    price: 399.95,
    tier: 'essential',
    phase: 'PHASE_1_TODAY',
    description: 'ThermoJet 3-second heat up with automatic microfoam steam wand'
  },
  {
    id: 'sku-baratza-esp',
    name: 'Baratza Encore ESP Conical Burr Grinder',
    brand: 'Baratza',
    category: 'Coffee Grinder',
    price: 199.95,
    tier: 'essential',
    phase: 'PHASE_1_TODAY',
    description: '40-step high-resolution espresso & filter grind adjustment'
  }
];

for (const item of SEED_PRODUCTS) {
  DYNAMIC_SKU_REGISTRY.set(item.id, item);
}

export function registerProductsInQuoteStore(products: Product[]): Product[] {
  const sanitized: Product[] = [];
  for (const p of products) {
    const cleanCents = Math.max(500, Math.min(500000, Math.round(Number(p.price) * 100)));
    const cleanPrice = Number((cleanCents / 100).toFixed(2));
    const item: Product = {
      id: String(p.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || `sku-${Date.now()}`,
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

export function findProductBySku(skuId: string): Product | undefined {
  return DYNAMIC_SKU_REGISTRY.get(skuId);
}

export function getRegisteredSkuCount(): number {
  return DYNAMIC_SKU_REGISTRY.size;
}
