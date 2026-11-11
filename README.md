# SplitCart AI — Universal E-Commerce Product Discovery & Paycheck-Aligned Cash-Flow Planner

> **PayPal AI Hackathon 2026 Submission**  
> SplitCart AI solves cash-flow fragmentation, BNPL loan stacking, and rent-date overdraft collisions for 0% APR PayPal Pay in 4.

---

## 🚀 The Problem ("Why Now?")
* **The Living Expense Collision:** According to the **Federal Reserve Board's SHED & FEDS Notes (June 2026)**, **18% of liquidity-constrained BNPL users** incurred bank overdraft fees when automated installment pulls collided directly with rent day.
* **The Paycheck Reality:** **84.7% of Americans budget** and **48% live paycheck-to-paycheck** (Debt.com), yet standard e-commerce carts only display total price—blindsiding shoppers with 4-payment schedules that land on heavy bill days.
* **The Solution:** SplitCart AI acts as an intelligent pre-cart planner that maps any shopping goal against your bi-weekly payroll and bill calendar, automatically staggering purchases into safe, non-colliding paycheck phases.

---

## 🏗️ Visual Architecture & Data Flow

```mermaid
graph TD
    A["Shopper Goal & Budget"] -->|POST /api/agent/plan| B[Backend Cash-Flow Controller]
    B -->|Gemini 3.8-Flash API| C{AI Discovery}
    C -->|Success| D[Real Retail Products]
    C -->|Timeout / Error| E[Fallback Generator]
    D & E --> F[Quote Registry & HMAC Signer]
    F -->|SHA-256 Hash| G[Client UI & Schedule]
    G -->|Create Order| H[PayPal Orders v2 API]
    H -->|Pay in 4 / Pay Later| I[Verified Payment Capture]
 ```

🔒 Security & Guardrail Contracts
Server-Side HMAC-SHA256 Cart Signing: Prevents client-side price tampering by cryptographically binding SKU IDs and integer cent totals.

Cent-Exact Floating Math Elimination: All calculations are executed in integer cents (Math.round(price * 100)) to eliminate float drift across 4 equal installments.

Bill-Day Buffer Validation: Scans the 4-payment timeline against your selected bill/rent date (e.g., the 1st of the month) and flags potential liquidity collisions.

🛠️ Testing & Execution
To run your backend unit and integration test suite directly from your local terminal:

Bash
cd server
npm run build
node --test "dist/**/*.spec.js"
