## Visual Architecture & Data Flow
 ```mermaid`ngraph TD
 A[`"Shopper Goal & Budget`"] -->|POST /api/agent/plan| B[Backend Cash-Flow Controller]   
 B -->|Gemini 3.8-Flash API| C{AI Discovery}
 C -->|Success| D[Real Retail Products] 
 C -->|Timeout / Error| E[Fallback Generator] 
 D & E --> F[Quote Registry & HMAC Signer]
 F -->|SHA-256 Hash| G[Client UI & Schedule]  
 G -->|Create Order| H[PayPal Orders v2 API] 
 H -->|Pay in 4 / Pay Later| I[Verified Payment Capture]```
 
 ## 🔒 Security & Guardrail Contracts
 * **Server-Side HMAC-SHA256 Cart Signing:** Prevents client-side price tampering by cryptographically binding SKU IDs and integer cent totals.
 * * **Cent-Exact Floating Math Elimination:** All calculations are executed in integer cents (Math.round(price * 100)) to eliminate float drift across 4 equal installments.
   * * **Bill-Day Buffer Validation:** Scans the 4-payment timeline against your selected bill/rent date (e.g., the 1st of the month) and flags potential liquidity collisions.
