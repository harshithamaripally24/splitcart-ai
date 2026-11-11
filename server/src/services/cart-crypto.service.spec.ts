import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProductsInQuoteStore } from '../repositories/quote-registry.repository';
import { computeInstallmentsInDollars, verifyAndSignCart } from './cart-crypto.service';
import { ValidationError } from '../errors/http-errors';

test('cart-crypto.service: Cent-exact installment math sums to 100% without float drift', () => {
  const installments = computeInstallmentsInDollars(55001);
  const sumCents = installments.reduce((sum, val) => sum + Math.round(val * 100), 0);
  assert.equal(sumCents, 55001);
  assert.equal(installments[0], 137.51);
  assert.equal(installments[1], 137.50);
});

test('cart-crypto.service: Rejects duplicate SKU IDs and unregistered SKUs', () => {
  registerProductsInQuoteStore([
    {
      id: 'spec-sku-1',
      name: 'Breville Bambino',
      category: 'Kitchen',
      price: 299.99,
      tier: 'essential',
      phase: 'PHASE_1_TODAY',
      description: 'Test'
    }
  ]);

  assert.throws(
    () => verifyAndSignCart(['spec-sku-1', 'spec-sku-1']),
    (err: any) => err instanceof ValidationError && err.message.includes('DUPLICATE_SKU_DETECTED')
  );

  assert.throws(
    () => verifyAndSignCart(['unregistered-sku-999']),
    (err: any) => err instanceof ValidationError && err.message.includes('UNKNOWN_SKU_ID')
  );
});
