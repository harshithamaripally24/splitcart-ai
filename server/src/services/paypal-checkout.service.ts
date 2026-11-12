import { ENV } from '../config/env.config';
import { ValidationError, UpstreamServiceError } from '../errors/http-errors';
import { verifyAndSignCart, verifyCartHashMatch } from './cart-crypto.service';

const REQUEST_TIMEOUT_MS = 10000;
const VALID_PAYPAL_ORDER_ID = /^[A-Za-z0-9]{10,36}$/;

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) {
    return cachedToken;
  }

  if (!ENV.PAYPAL_CLIENT_ID || !ENV.PAYPAL_CLIENT_SECRET) {
    throw new UpstreamServiceError('PayPal credentials are not configured on the server.');
  }

  const auth = Buffer.from(`${ENV.PAYPAL_CLIENT_ID}:${ENV.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${ENV.PAYPAL_API_BASE}/v1/oauth2/token`, {
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
    throw new UpstreamServiceError(`PayPal OAuth failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken;
}

export async function createPayPalOrder(skuIds: string[], expectedCartHash?: string) {
  const { items, total, cartHash } = verifyAndSignCart(skuIds);

  if (!expectedCartHash || typeof expectedCartHash !== 'string') {
    throw new ValidationError('CART_HASH_REQUIRED: A valid server-signed cartHash is required.');
  }

  if (!verifyCartHashMatch(cartHash, expectedCartHash)) {
    throw new ValidationError(
      'CART_TAMPER_DETECTED: Provided cartHash does not match server signature.'
    );
  }

  const token = await getPayPalAccessToken();
  const timeBucket = Math.floor(Date.now() / (10000));
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

  const response = await fetch(`${ENV.PAYPAL_API_BASE}/v2/checkout/orders`, {
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
    throw new UpstreamServiceError(`PayPal order creation failed (${response.status}).`);
  }

  return orderData;
}

export async function capturePayPalOrder(orderId: string) {
  if (!orderId || typeof orderId !== 'string' || !VALID_PAYPAL_ORDER_ID.test(orderId.trim())) {
    throw new ValidationError('INVALID_ORDER_ID: Order ID must be a 10-36 character alphanumeric PayPal ID.');
  }

  const cleanOrderId = encodeURIComponent(orderId.trim());
  const token = await getPayPalAccessToken();
  const captureIdempotencyKey = `splitcart-capture-${cleanOrderId}`;

  const response = await fetch(`${ENV.PAYPAL_API_BASE}/v2/checkout/orders/${cleanOrderId}/capture`, {
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
    throw new UpstreamServiceError(`PayPal capture failed with status ${response.status}.`);
  }

  const captureUnit = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
  const captureStatus = captureUnit?.status || captureData?.status || 'UNKNOWN';

  if (captureStatus !== 'COMPLETED' && captureStatus !== 'PENDING' && captureStatus !== 'APPROVED') {
    throw new ValidationError(`CAPTURE_NOT_COMPLETED: PayPal returned status "${captureStatus}".`);
  }

  return {
    ...captureData,
    captureId: captureUnit?.id || captureData.id
  };
}
