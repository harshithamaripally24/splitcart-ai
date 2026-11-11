import { Request, Response, NextFunction } from 'express';
import { buildCashFlowBundlePlan } from '../services/cashflow-planner.service';
import { getPayPalAccessToken } from '../services/paypal-checkout.service';
import { getRegisteredSkuCount } from '../repositories/quote-registry.repository';
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
