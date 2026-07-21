# Security model

Groq is advisory. Its output is strict-schema parsed, length bounded, deduplicated, and rejected
if it contains URLs, account IDs, networks, assets, prices, credentials, or payment language.
The deterministic fallback has the same resource-only output. Neither planner nor synthesis can
change a budget or assert settlement.

The local registry is the sole source for endpoint path, resource ID, seller, network, asset,
price, and response schema. Policy checks the complete task before signing and every 402 again
immediately before signing. It requires Hedera testnet, native HBAR, exact seller and price,
unexpired requirements, allowlisted IDs, payment-count and integer-tinybar budget limits, period
spend, idempotency, and balance when available.

Keys stay in ignored mode-600 environment files and are never stored in SQLite. Events, errors,
API output, and demo output are sanitized; raw authorization headers and signed payloads are not
persisted. Only payment digests and public transaction evidence are durable. Mainnet is refused.
Fixture responses are curated demonstrations, not live advice.

## Browser boundary

The browser receives public account IDs, policy limits, catalogue metadata, sanitized events,
validated intelligence, and public receipts only. It never stores sensitive information in
localStorage, sessionStorage, IndexedDB, analytics, or console output. Task submission is disabled
while pending, carries an idempotency key in header and body, and requires the API to reuse an
existing task for duplicate keys. Live mode additionally requires the exact 16,000,000-tinybar
confirmation; UI controls cannot override registry or policy checks.
