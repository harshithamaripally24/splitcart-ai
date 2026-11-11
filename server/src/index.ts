import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateBundlePlan } from './agent';
import { createPayPalOrder, capturePayPalOrder, getPayPalAccessToken, ValidationError } from './paypal';
import { getRegistrySize } from './catalog';

dotenv.config();

const app = express();
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://splitcart-ai-1.onrender.com']
  })
);
app.use(express.json({ limit: '32kb' }));

const PORT = process.env.PORT || 3001;

// Lightweight in-memory IP rate limiter (30 requests / minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count += 1;
  return true;
}

// 1. Live Health & Sandbox Readiness Check
app.get('/api/health', async (_req, res) => {
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
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    catalogMode: 'dynamic-gemini-discovery',
    registeredSkus: getRegistrySize(),
    timestamp: new Date().toISOString()
  });
});

// 2. Public Client Config (Only public PayPal Client ID — no buyer passwords!)
app.get('/api/config', (_req, res) => {
  res.json({
    paypalClientId: process.env.PAYPAL_CLIENT_ID || ''
  });
});

// Backwards-compatible alias without sensitive buyer credentials
app.get('/api/judge-info', (_req, res) => {
  res.json({
    paypalClientId: process.env.PAYPAL_CLIENT_ID || ''
  });
});

// 3. Generate / Negotiate Dynamic Bundle Plan with Gemini + Deterministic BNPL Engine
app.post('/api/agent/plan', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip, 25, 60000)) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    return;
  }

  try {
    const { userGoal, biWeeklyBudget, tradeOffPrompt, rentDueDay } = req.body || {};
    const plan = await generateBundlePlan(
      userGoal || 'Home Espresso & Coffee Bar Setup',
      Number(biWeeklyBudget) || 140,
      tradeOffPrompt,
      Number(rentDueDay) || 1
    );
    res.json(plan);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[API /api/agent/plan Error]:', err?.message || err);
    res.status(502).json({ error: 'Unable to generate bundle plan right now. Please try again.' });
  }
});

// 4. Create Verified PayPal Sandbox Order (Orders v2 API)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { skuIds, cartHash } = req.body || {};
    const order = await createPayPalOrder(skuIds, cartHash);
    res.json(order);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[API /api/paypal/create-order Error]:', err?.message || err);
    res.status(502).json({ error: 'Unable to initialize PayPal order. Please verify your selection.' });
  }
});

// 5. Capture Approved PayPal Sandbox Order
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body || {};
    const capture = await capturePayPalOrder(orderID);
    res.json(capture);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[API /api/paypal/capture-order Error]:', err?.message || err);
    res.status(502).json({ error: 'PayPal order capture could not be completed.' });
  }
});

app.listen(PORT, () => {
  console.log(`SplitCart AI Backend live on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});