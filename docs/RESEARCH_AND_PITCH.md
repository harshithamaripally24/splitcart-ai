# SplitCart AI - Research Context & Product Framing

## 1. Budgeting & Paycheck Survey Data
- **Debt.com 2026 Budgeting Survey:**
  - **Source URL:** https://www.debt.com/research/best-way-to-budget/
  - **Reported Findings:**
    - **84.67% of survey respondents** said they budget.
    - **48% of survey respondents** reported living paycheck to paycheck.

## 2. Product Scope & Accurate Technical Claims
- **Estimated Installment Timeline:** SplitCart AI estimates four bi-weekly installment dates (`Day 0, +14d, +28d, +42d`) and flags whether any estimated date falls within 2 days of the user's selected monthly bill date. When a conflict is detected, it displays the shifted 4-payment dates from the recommended purchase date and provides a downloadable `.ics` calendar reminder. It is a planning visualization, not an automated payment scheduler or overdraft guarantee.
- **Separate Manual Phase Checkouts:** Shoppers can filter their cart to buy Phase 1 (Essentials) today and return later to purchase Phase 2 (Extras) in a separate checkout. The app does not automatically schedule or trigger the second purchase.
- **PayPal Capture Status Handling:** `paypal-checkout.service.ts` verifies that the PayPal Orders v2 capture response returns `COMPLETED`, `PENDING`, or `APPROVED` before confirming the order in the UI.
