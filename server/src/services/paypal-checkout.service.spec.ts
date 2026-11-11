import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePayPalOrder } from './paypal-checkout.service';
import { ValidationError } from '../errors/http-errors';

test('paypal-checkout.service: Blocks path traversal and malformed orderIDs', async () => {
  await assert.rejects(
    async () => capturePayPalOrder('../../v1/oauth2/token'),
    (err: any) => err instanceof ValidationError && err.message.includes('INVALID_ORDER_ID')
  );

  await assert.rejects(
    async () => capturePayPalOrder('short'),
    (err: any) => err instanceof ValidationError && err.message.includes('INVALID_ORDER_ID')
  );
});
