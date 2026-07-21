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
