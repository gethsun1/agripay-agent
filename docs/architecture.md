# Architecture

```mermaid
flowchart LR
  Web[Next.js web] --> API[Agent API]
  API --> Planner[Groq or deterministic planner]
  API --> Buyer[Payment buyer]
  Buyer --> Resource[Protected resource server]
  Resource -->|HTTP 402 / HTTP 200| Buyer
  Resource --> Facilitator[Hedera facilitator]
  Facilitator --> Testnet[Hedera testnet]
  API --> Store[(SQLite receipts and events)]
```

AI may select only registered resources. It cannot supply URLs, recipients, prices, payment
status, or policy values. The deterministic policy package is independent of the planner and
uses integer tinybars throughout.

All fixture intelligence is curated demonstration data and is not meteorological, agronomic,
disease-surveillance, financial, or market advice.

## Phase 1 account roles

The bootstrap operator funds three distinct ECDSA testnet roles. The buyer signs the HBAR debit,
the seller receives the exact resource price, and the facilitator adds its fee-payer signature,
submits the transaction, and waits for the Hedera receipt. Browser code holds no key material.

The pinned alpha verifier is wrapped with exact transfer and signature introspection described
in [ADR 0002](adr/0002-hedera-exact-verification.md).
