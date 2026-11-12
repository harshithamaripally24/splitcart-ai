import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 3001,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  PAYPAL_API_BASE: process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com',
  CART_HMAC_SECRET: process.env.CART_HMAC_SECRET || process.env.PAYPAL_CLIENT_SECRET || 'splitcart-hmac-2026',
  ALLOWED_ORIGINS: ['http://localhost:5173', 'https://splitcart-ai-1.onrender.com']
};
