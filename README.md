# SplitCart AI — Universal E-Commerce Product Discovery & Paycheck-Aligned Cash-Flow Planner

> **PayPal AI Hackathon 2026 Submission**  
> SplitCart AI solves cash-flow fragmentation, BNPL loan stacking, and rent-date overdraft collisions for 0% APR PayPal Pay in 4.

## 🚀 The Problem ("Why Now?")
* **The Living Expense Collision:** According to the **Federal Reserve Board's SHED & FEDS Notes (June 2026)**, **18% of liquidity-constrained BNPL users** incurred bank overdraft fees when automated installment pulls collided directly with rent day.
* **The Paycheck Reality:** **84.7% of Americans budget** and **48% live paycheck-to-paycheck** (Debt.com), yet standard e-commerce carts only display total price—blindsiding shoppers with 4-payment schedules that land on heavy bill days.
* **The Solution:** SplitCart AI acts as an intelligent pre-cart planner that maps any shopping goal against your bi-weekly payroll and bill calendar, automatically staggering purchases into safe, non-colliding paycheck phases.

## 🏗️ Visual Architecture & Data Flow

```mermaid
graph TD
    A["Shopper Goal & 2-Wk Budget"] -->|"POST /api/agent/plan"| B["Backend Cash-Flow Controller"]
    B -->|"Gemini 3.8-Flash API"| C{"AI Discovery"}
    C -->|"Live Success"| D["Real Retail Products & Prices"]
    C -->|"Timeout or Error"| E["Deterministic Fallback Generator"]
    D --> F["Quote Registry & HMAC Signer"]
    E --> F
    F -->|"HMAC-SHA256 Signature"| G["Client UI: Cards & Pay Schedule"]
    G -->|"Create Order + HMAC"| H["PayPal Orders v2 REST API"]
    H -->|"0% APR Pay in 4"| I["Verified Payment Capture & Audit"]
```

## 🔒 Security & Guardrail Contracts
* **Server-Side HMAC-SHA256 Cart Signing:** Prevents client-side price tampering by cryptographically binding SKU IDs and integer cent totals.
* **Cent-Exact Floating Math Elimination:** All calculations are executed in integer cents (`Math.round(price * 100)`) to eliminate float drift across 4 equal installments.
* **Bill-Day Buffer Validation:** Scans the 4-payment timeline against your selected bill/rent date (e.g., the 1st of the month) and flags potential liquidity collisions.

## 🛠️ Testing & Execution

To run the backend unit and integration test suite from your local terminal:

```bash
cd server
npm run build
node --test "dist/**/*.spec.js"
```


*Disclaimer: This is a personal project. The views, code and opinions expressed here are my own and do not represent those of my current or past employers.*

## Current Prototype Scope & Limitations
- **Who This Is For:** Built as a consumer pre-checkout cash-flow planner ("Plan what to buy and when, so the payments never collide with your bills"), architected to evolve into an embeddable merchant checkout widget.
- **Role of Gemini vs. Deterministic Code:** Gemini translates plain-language goals into a prioritized checklist of Essentials first and Extras second; deterministic TypeScript code performs all cent-exact installment math, bill-day collision checks, and HMAC-SHA256 signing so the AI never touches payment math.
- **Illustrative Demo Pricing:** Product prices are illustrative demo estimates (`Est. $XX.XX`), not live store feeds. Because a PayPal order goes to one merchant, production deployment pairs one checkout order per store.
- **PayPal Sandbox Only:** Checkout runs in the US PayPal Sandbox (`USD`, Pay in 4 eligible from `$30.00` to `$1,500.00`).
