# SplitCart AI 🛒✨
*Agentic Bundle Negotiator & PayPal Pay Later Cash-Flow Optimizer*

SplitCart AI is a full-stack fintech application designed to eliminate cart abandonment by combining LLM-powered bundle negotiation with automated PayPal BNPL (Buy Now, Pay Later) financing caps.

## Features
- **Agentic Bundle Negotiation:** Dynamically adjusts shopping cart bundles to stay under a custom bi-weekly financial cap.
- **Cryptographic Cart Integrity:** Ensures secure transactions with deterministic node-side math and SHA-256 cart hashing.
- **Live PayPal Pay Later Integration:** Fully tested end-to-end sandbox checkout supporting PayPal Pay in 4 and Pay Monthly options.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, AG Grid
- **Backend:** Node.js, Express
- **AI & APIs:** Google Gemini API (`gemini-3.8-flash`), PayPal Orders v2 API

## Getting Started Locally

### Prerequisites
- Node.js installed on your machine
- A PayPal Developer Sandbox account
- A Google AI Studio API Key (Gemini)

### 1. Setup Backend
cd server
npm install
npm run dev

### 2. Setup Frontend
cd client
npm install
npm run dev

## Testing Sandbox Checkout
To test the PayPal Pay Later sandbox checkout locally:
1. Configure your own `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in your `server/.env` file.
2. Log into the PayPal sandbox popup using your own PayPal Developer Sandbox **Personal (Buyer)** account credentials.

