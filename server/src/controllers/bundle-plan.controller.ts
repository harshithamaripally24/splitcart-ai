import { Request, Response, NextFunction } from 'express';
import { buildCashFlowBundlePlan } from '../services/cashflow-planner.service';
import { getPayPalAccessToken } from '../services/paypal-checkout.service';
import {
  computeInstallmentsInDollars,
  verifyAndSignCart,
  verifySingleItemQuote
} from '../services/cart-crypto.service';
import {
  findProductBySku,
  getRegisteredSkuCount,
  registerProductsInQuoteStore
} from '../repositories/quote-registry.repository';
import { ENV } from '../config/env.config';
import { Product } from '../types/commerce.types';

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
    const parsedBudget =
      biWeeklyBudget === undefined || biWeeklyBudget === '' ? 160 : Number(biWeeklyBudget);

    const plan = await buildCashFlowBundlePlan(
      userGoal || 'Craft Home Espresso & Matcha Bar Setup',
      parsedBudget,
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

    if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
      const verifiedMissing = fallbackItems.filter(
        (item: any) =>
          item?.id &&
          !findProductBySku(String(item.id)) &&
          verifySingleItemQuote(String(item.id), Number(item.price), item.itemSig)
      );
      if (verifiedMissing.length > 0) {
        registerProductsInQuoteStore(verifiedMissing);
      }
    }

    const verified = verifyAndSignCart(skuIds);
    const installments = computeInstallmentsInDollars(verified.totalCents);
    res.json({
      skuIds: verified.items.map((i: Product) => i.id),
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
