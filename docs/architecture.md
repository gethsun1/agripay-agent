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
