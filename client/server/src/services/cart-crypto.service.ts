import crypto from 'crypto';
import { ENV } from '../config/env.config';
import { ValidationError } from '../errors/http-errors';
import { findProductBySku } from '../repositories/quote-registry.repository';
import { Product } from '../types/commerce.types';

export function computeInstallmentsInDollars(totalCents: number): [number, number, number, number] {
  const baseCents = Math.floor(totalCents / 4);
  const remainder = totalCents - baseCents * 4;
  return [
    Number(((baseCents + remainder) / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2))
  ];
}

export function verifyAndSignCart(skuIds: string[]): {
  items: Product[];
  total: number;
  totalCents: number;
  cartHash: string;
} {
  if (!Array.isArray(skuIds) || skuIds.length === 0 || skuIds.length > 12) {
    throw new ValidationError('INVALID_CART: Provide between 1 and 12 valid SKU IDs.');
  }

  const uniqueIds = Array.from(new Set(skuIds.map(id => String(id).trim())));
  if (uniqueIds.length !== skuIds.length) {
    throw new ValidationError('DUPLICATE_SKU_DETECTED: Duplicate SKU IDs are not permitted in a bundle.');
  }

  const items: Product[] = [];
  for (const id of uniqueIds) {
    const product = findProductBySku(id);
    if (!product) {
      throw new ValidationError(`UNKNOWN_SKU_ID: SKU "${id}" is not registered in the server quote store.`);
    }
    items.push(product);
  }

  const totalCents = items.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
  const total = Number((totalCents / 100).toFixed(2));

  const canonicalString =
    items
      .map(i => `${i.id}:${Math.round(i.price * 100)}`)
      .sort()
      .join('|') + `|TOTAL_CENTS:${totalCents}`;

  const cartHash = crypto
    .createHmac('sha256', ENV.CART_HMAC_SECRET)
    .update(canonicalString)
    .digest('hex')
    .substring(0, 16);

  return { items, total, totalCents, cartHash };
}
