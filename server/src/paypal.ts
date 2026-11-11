import dotenv from 'dotenv';
import crypto from 'crypto';
import { getProductById, Product } from './catalog';

dotenv.config();

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const BASE_URL = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const HMAC_SECRET = process.env.CART_HMAC_SECRET || CLIENT_SECRET || 'splitcart-server-hmac-key-2026';
const REQUEST_TIMEOUT_MS = 10000;

export class ValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) {
    return cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('PayPal Sandbox credentials are not configured on the server.');
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
    throw new Error(`PayPal OAuth failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken;
}

export function computeInstallmentsInDollars(totalCents: number): [number, number, number, number] {
  const baseCents = Math.floor(totalCents / 4);
  const remainder = totalCents - baseCents * 4;
  // First installment absorbs any 1-3 cent remainder so all 4 sum to exact totalCents
  return [
    Number(((baseCents + remainder) / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2)),
    Number((baseCents / 100).toFixed(2))
  ];
}

export function verifyAndHashCart(skuIds: string[]): {
  items: Product[];
  total: number;
  totalCents: number;
  cartHash: string;
} {
  if (!Array.isArray(skuIds) || skuIds.length === 0 || skuIds.length > 12) {
    throw new ValidationError('INVALID_CART: Provide between 1 and 12 valid SKU IDs.');
  }

  // Deduplicate and verify all requested SKUs exist in server registry
  const uniqueIds = Array.from(new Set(skuIds.map(id => String(id).trim())));
  if (uniqueIds.length !== skuIds.length) {
    throw new ValidationError('DUPLICATE_SKU_DETECTED: Duplicate SKU IDs are not permitted in a bundle.');
  }

  const items: Product[] = [];
  for (const id of uniqueIds) {
    const product = getProductById(id);
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
    .createHmac('sha256', HMAC_SECRET)
    .update(canonicalString)
    .digest('hex')
    .substring(0, 16);

  return { items, total, totalCents, cartHash };
}

export async function createPayPalOrder(skuIds: string[], expectedCartHash?: string) {
  const { items, total, cartHash } = verifyAndHashCart(skuIds);

  if (!expectedCartHash || typeof expectedCartHash !== 'string') {
    throw new ValidationError('CART_HASH_REQUIRED: A valid server-signed cartHash is required.');
  }

  if (expectedCartHash !== cartHash) {
    throw new ValidationError(
      `CART_TAMPER_DETECTED: Provided cartHash (${expectedCartHash}) does not match server HMAC (${cartHash}).`
    );
  }

  const token = await getPayPalAccessToken();
  // 5-minute bucketed idempotency key so rapid retries deduplicate safely
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const idempotencyKey = `splitcart-order-${cartHash}-${timeBucket}`;

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `bundle_${cartHash}`,
        custom_id: `hmac_${cartHash}`,
        description: `SplitCart AI Bundle (${items.length} items)`,
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
          name: item.name.slice(0, 120),
          sku: item.id.slice(0, 64),
          unit_amount: {
            currency_code: 'USD',
            value: item.price.toFixed(2)
          },
          quantity: '1'
        }))
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'SplitCart AI',
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
  if (!response.ok || !orderData.id) {
    throw new Error(`PayPal order creation failed (${response.status}).`);
  }

  return {
    ...orderData,
    _splitcartAudit: {
      cartHash,
      hmacVerified: true,
      idempotencyKey,
      verifiedTotal: total,
      itemCount: items.length,
      timestamp: new Date().toISOString()
    }
  };
}

const VALID_PAYPAL_ORDER_ID = /^[A-Za-z0-9]{10,36}$/;

export async function capturePayPalOrder(orderId: string) {
  if (!orderId || typeof orderId !== 'string' || !VALID_PAYPAL_ORDER_ID.test(orderId.trim())) {
    throw new ValidationError('INVALID_ORDER_ID: Order ID must be a 10-36 character alphanumeric PayPal ID.');
  }

  const cleanOrderId = encodeURIComponent(orderId.trim());
  const token = await getPayPalAccessToken();
  const captureIdempotencyKey = `splitcart-capture-${cleanOrderId}`;

  const response = await fetch(`${BASE_URL}/v2/checkout/orders/${cleanOrderId}/capture`, {
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
    throw new Error(`PayPal capture failed with status ${response.status}.`);
  }

  const captureUnit = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
  const captureStatus = captureUnit?.status || captureData?.status || 'UNKNOWN';

  if (captureStatus !== 'COMPLETED') {
    throw new ValidationError(`CAPTURE_NOT_COMPLETED: PayPal returned status "${captureStatus}".`);
  }

  return {
    ...captureData,
    captureId: captureUnit?.id || captureData.id,
    _splitcartCaptureAudit: {
      orderId: cleanOrderId,
      captureId: captureUnit?.id || null,
      captureStatus,
      idempotencyKey: captureIdempotencyKey,
      sellerReceivableBreakdown: captureUnit?.seller_receivable_breakdown || null,
      capturedAt: new Date().toISOString()
    }
  };
}