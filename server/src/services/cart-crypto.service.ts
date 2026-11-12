import crypto from 'crypto';
import { ENV } from '../config/env.config';
import { findProductBySku } from '../repositories/quote-registry.repository';
import { ValidationError } from '../errors/http-errors';
import { Product } from '../types/commerce.types';

const SECRET = ENV.CART_HMAC_SECRET;

export function signSingleItemQuote(id: string, price: number): string {
  const cleanId = String(id).trim();
  const priceCents = Math.round(Number(price) * 100);
  return crypto
    .createHmac('sha256', SECRET)
    .update('item-quote:' + cleanId + ':' + priceCents)
    .digest('hex')
    .slice(0, 24);
}

export function verifySingleItemQuote(id: string, price: number, itemSig?: string): boolean {
  if (!itemSig || typeof itemSig !== 'string') return false;
  const expected = signSingleItemQuote(id, price);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(String(itemSig), 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function computeInstallmentsInDollars(totalCents: number): [number, number, number, number] {
  const safeCents = Math.max(0, Math.round(totalCents));
  const baseCents = Math.floor(safeCents / 4);
  const remainderCents = safeCents - baseCents * 4;

  return [
    Number(((baseCents + remainderCents) / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2))
  ];
}

export function verifyCartHashMatch(expectedHash: string, providedHash?: string): boolean {
  if (!providedHash || typeof providedHash !== 'string') return false;
  const a = Buffer.from(expectedHash, 'utf8');
  const b = Buffer.from(String(providedHash), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyAndSignCart(
  skuIds: string[],
  clientProvidedHash?: string
): {
  items: Product[];
  total: number;
  totalCents: number;
  cartHash: string;
} {
  if (!Array.isArray(skuIds) || skuIds.length === 0) {
    throw new ValidationError('EMPTY_CART: Cart must contain at least one valid SKU.');
  }

  const normalizedIds = skuIds.map(id => String(id).trim()).filter(Boolean);
  if (normalizedIds.length === 0) {
    throw new ValidationError('EMPTY_CART: Cart must contain at least one valid SKU.');
  }

  const seen = new Set<string>();
  const items: Product[] = [];

  for (const id of normalizedIds) {
    if (seen.has(id)) {
      throw new ValidationError('DUPLICATE_SKU_DETECTED: Duplicate SKU "' + id + '" is not allowed.');
    }
    seen.add(id);

    const product = findProductBySku(id);
    if (!product) {
      throw new ValidationError(
        'UNKNOWN_SKU_ID: SKU "' + id + '" is not registered in the server quote store.'
      );
    }
    items.push({
      ...product,
      itemSig: signSingleItemQuote(product.id, product.price)
    });
  }

  const totalCents = items.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
  const total = Number((totalCents / 100).toFixed(2));

  const canonicalPayload =
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(i => i.id + ':' + Math.round(i.price * 100))
      .join('|') + '|total:' + totalCents;

  const expectedHash = crypto
    .createHmac('sha256', SECRET)
    .update(canonicalPayload)
    .digest('hex')
    .slice(0, 24);

  if (clientProvidedHash !== undefined && !verifyCartHashMatch(expectedHash, clientProvidedHash)) {
    throw new ValidationError('CART_TAMPER_DETECTED: Cart signature verification failed.');
  }

  return {
    items,
    total,
    totalCents,
    cartHash: expectedHash
  };
}
