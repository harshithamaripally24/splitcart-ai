import dotenv from 'dotenv';
import crypto from 'crypto';
import { CATALOG, Product } from './catalog';

dotenv.config();

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const BASE_URL = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const REQUEST_TIMEOUT_MS = 10000; // 10s explicit timeout (APIMatic Context Plugin best practice)

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) {
    return cachedToken;
  }

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    cachedToken = null;
    tokenExpiry = 0;
    const errorText = await response.text();
    throw new Error(`PayPal Auth Failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken;
}

export function verifyAndHashCart(skuIds: string[]): { items: Product[]; total: number; cartHash: string } {
  if (!Array.isArray(skuIds) || skuIds.length === 0) {
    throw new Error('DETERMINISTIC_GUARD_ERROR: No SKU IDs array provided.');
  }

  const items = skuIds
    .map(id => CATALOG.find(p => p.id === id))
    .filter((p): p is Product => p !== undefined);

  if (items.length === 0) {
    throw new Error('DETERMINISTIC_GUARD_ERROR: No valid catalog SKUs provided.');
  }

  const total = Number(items.reduce((sum, item) => sum + item.price, 0).toFixed(2));
  const canonicalString =
    items.map(i => `${i.id}:${i.price.toFixed(2)}`).sort().join('|') + `|TOTAL:${total.toFixed(2)}`;
  const cartHash = crypto.createHash('sha256').update(canonicalString).digest('hex').substring(0, 16);

  return { items, total, cartHash };
}

export async function createPayPalOrder(skuIds: string[], expectedCartHash?: string) {
  // 1. Deterministic Server-Side Lookup & Cryptographic Hash Verification
  const { items, total, cartHash } = verifyAndHashCart(skuIds);

  if (expectedCartHash && expectedCartHash !== cartHash) {
    throw new Error(
      `CART_TAMPER_DETECTED: Expected cart hash (${expectedCartHash}) does not match server-computed hash (${cartHash}).`
    );
  }

  const token = await getPayPalAccessToken();
  const idempotencyKey = `splitcart-create-${cartHash}-${Date.now()}`;

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `bundle_${cartHash}`,
        custom_id: `sha256_${cartHash}`,
        description: `SplitCart AI Verified Bundle (${items.length} items)`,
        amount: {
          currency_code: 'USD',
          value: total.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: total.toFixed(2)
            }
          }
        },
        items: items.map(item => ({
          name: item.name,
          sku: item.id,
          unit_amount: {
            currency_code: 'USD',
            value: item.price.toFixed(2)
          },
          quantity: '1',
          category: 'PHYSICAL_GOODS'
        }))
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'SplitCart Pro',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      }
    }
  };

  const response = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': idempotencyKey,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const orderData = (await response.json()) as Record<string, any>;
  if (!response.ok) {
    throw new Error(`PayPal Orders v2 Create Failed: ${JSON.stringify(orderData)}`);
  }

  return {
    ...orderData,
    _splitcartAudit: {
      cartHash,
      hashVerified: expectedCartHash ? expectedCartHash === cartHash : true,
      idempotencyKey,
      verifiedTotal: total,
      itemCount: items.length,
      experienceContext: 'PAY_NOW / NO_SHIPPING',
      timestamp: new Date().toISOString()
    }
  };
}

export async function capturePayPalOrder(orderId: string) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('INVALID_ORDER_ID: A valid PayPal orderID is required for capture.');
  }

  const token = await getPayPalAccessToken();
  const captureIdempotencyKey = `splitcart-capture-${orderId}`;

  const response = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': captureIdempotencyKey,
      Prefer: 'return=representation'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const captureData = (await response.json()) as Record<string, any>;
  if (!response.ok) {
    throw new Error(`PayPal Capture Failed: ${JSON.stringify(captureData)}`);
  }

  const captureUnit = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    ...captureData,
    _splitcartCaptureAudit: {
      orderId,
      captureId: captureUnit?.id || null,
      captureStatus: captureUnit?.status || captureData?.status,
      idempotencyKey: captureIdempotencyKey,
      sellerReceivableBreakdown: captureUnit?.seller_receivable_breakdown || null,
      capturedAt: new Date().toISOString()
    }
  };
}