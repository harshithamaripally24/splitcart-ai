import { Request, Response, NextFunction } from 'express';
import { buildCashFlowBundlePlan } from '../services/cashflow-planner.service';
import { getPayPalAccessToken } from '../services/paypal-checkout.service';
import { computeInstallmentsInDollars, verifyAndSignCart } from '../services/cart-crypto.service';
import {
  findProductBySku,
  getRegisteredSkuCount,
  registerProductsInQuoteStore
} from '../repositories/quote-registry.repository';
import { ENV } from '../config/env.config';

export async function getHealthStatus(_req: Request, res: Response) {
  let paypalSandboxConnected = false;
  try {
    const token = await getPayPalAccessToken();
    paypalSandboxConnected = Boolean(token);
  } catch {
    paypalSandboxConnected = false;
  }

  res.json({
    service: 'splitcart-ai',
    status: 'ok',
    paypalSandboxConnected,
    geminiConfigured: Boolean(ENV.GEMINI_API_KEY),
    registeredSkus: getRegisteredSkuCount(),
    timestamp: new Date().toISOString()
  });
}

export function getPublicClientConfig(_req: Request, res: Response) {
  res.json({
    paypalClientId: ENV.PAYPAL_CLIENT_ID
  });
}

export async function createBundlePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userGoal, biWeeklyBudget, tradeOffPrompt, rentDueDay } = req.body || {};
    const plan = await buildCashFlowBundlePlan(
      userGoal || 'Craft Home Espresso & Matcha Bar Setup',
      Number(biWeeklyBudget) || 160,
      tradeOffPrompt,
      Number(rentDueDay) || 1
    );
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export function signCustomSelectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { skuIds, fallbackItems } = req.body || {};

    // If Render restarted and cleared in-memory store, re-hydrate missing SKUs before signing
    if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
      const missing = fallbackItems.filter((item: any) => item?.id && !findProductBySku(String(item.id)));
      if (missing.length > 0) {
        registerProductsInQuoteStore(missing);
      }
    }

    const verified = verifyAndSignCart(skuIds);
    const installments = computeInstallmentsInDollars(verified.totalCents);
    res.json({
      skuIds: verified.items.map(i => i.id),
      items: verified.items,
      totalPrice: verified.total,
      cartHash: verified.cartHash,
      biWeeklyAmount: installments[0],
      installments,
      payIn4Eligible: verified.totalCents >= 3000 && verified.totalCents <= 150000
    });
  } catch (err) {
    next(err);
  }
}