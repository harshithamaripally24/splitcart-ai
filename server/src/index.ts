import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateBundlePlan } from './agent';
import { createPayPalOrder, capturePayPalOrder, getPayPalAccessToken } from './paypal';
import { CATALOG } from './catalog';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// 1. Live Health & Sandbox Readiness Check
app.get('/api/health', async (req, res) => {
  let paypalSandboxConnected = false;
  try {
    const token = await getPayPalAccessToken();
    paypalSandboxConnected = Boolean(token);
  } catch (e) {
    paypalSandboxConnected = false;
  }

  res.json({
    service: 'splitcart-ai',
    status: 'ok',
    paypalSandboxConnected,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    catalogSize: CATALOG.length,
    timestamp: new Date().toISOString()
  });
});

// 2. Judge Quick-Test Info
app.get('/api/judge-info', (req, res) => {
  res.json({
    sandboxBuyerEmail: process.env.SANDBOX_BUYER_EMAIL || 'sb-buyer@personal.example.com',
    sandboxBuyerPassword: process.env.SANDBOX_BUYER_PASSWORD || 'sandbox-password',
    paypalClientId: process.env.PAYPAL_CLIENT_ID || ''
  });
});

// 3. Generate / Negotiate Bundle Plan with Gemini + Deterministic BNPL Engine
app.post('/api/agent/plan', async (req, res) => {
  try {
    const { userGoal, biWeeklyBudget, tradeOffPrompt } = req.body;
    const plan = await generateBundlePlan(
      userGoal || 'Remote Software Engineer Ergonomic Desk Setup',
      Number(biWeeklyBudget) || 140,
      tradeOffPrompt
    );
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create Real PayPal Sandbox Order (Orders v2 API)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { skuIds, cartHash } = req.body;
    const order = await createPayPalOrder(skuIds, cartHash);
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Capture Approved PayPal Sandbox Order
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    const capture = await capturePayPalOrder(orderID);
    res.json(capture);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SplitCart AI Backend live on http://localhost:${PORT}`);
  console.log(`🔍 Test health & PayPal Sandbox connection: http://localhost:${PORT}/api/health`);
});