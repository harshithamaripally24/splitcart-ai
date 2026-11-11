## Visual Architecture & Data Flow

``mermaid
graph TD
    A["Shopper Goal & Budget"] -->|POST /api/agent/plan| B[Backend Cash-Flow Controller]
    B -->|Gemini 3.8-Flash API| C{AI Discovery}
    C -->|Success| D[Real Retail Products]
    C -->|Timeout / Error| E[Fallback Generator]
    D & E --> F[Quote Registry & HMAC Signer]
    F -->|SHA-256 Hash| G[Client UI & Schedule]
    G -->|Create Order| H[PayPal Orders v2 API]
    H -->|Pay in 4 / Pay Later| I[Verified Payment Capture]
``
