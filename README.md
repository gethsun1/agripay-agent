# AgriPay Agent

> Autonomous intelligence, paid one insight at a time.

AgriPay Agent is an autonomous agricultural-intelligence procurement agent built for Hedera's
x402 bounty. It plans which registered insights a question needs, evaluates each payment with
deterministic spending controls, pays on Hedera testnet, retries protected HTTP resources, and
records public receipts.

The project is under active local development. Phase 0 provides strict configuration, the
server-controlled resource registry, and the payment policy foundation. Mock results are
always labelled and never presented as Hedera transactions.

## Why x402 and Hedera

x402 makes per-request payment part of ordinary HTTP: request, 402 requirements, signed
payment, settlement, and retry. Hedera provides a native HBAR rail with predictable fees and
public testnet evidence. This implementation is pinned to Hedera's alpha x402 v1 fork; it does
not silently mix current v2 headers into the flow.

## Spending controls

Only registered resources, exact configured prices, allowed sellers, HBAR, and Hedera testnet
are accepted. Per-resource, per-task, and periodic budgets use integer tinybars. Expiry,
idempotency, changed requirements, duplicates, and replay attempts are rejected before signing.

## Repository

- `packages/schemas`: trusted boundary schemas
- `packages/config`: secret-safe startup validation
- `packages/fixtures`: registered resources and demonstration data
- `packages/policy`: deterministic payment authorization
- `docs/adr`: compatibility and architecture decisions

See [local development](docs/local-development.md) and the [architecture](docs/architecture.md).

## Disclosure

Agricultural outputs use curated demonstration data. They are not live meteorological,
agronomic, disease-surveillance, financial, or market advice.

## License and attribution

Apache-2.0. The planned Hedera integration targets `hedera-dev/x402-hedera` commit
`d11dc65ab12fbdf644f1b2dba40fdd05f5a9ab1`, also Apache-2.0. See the ADR before modifying
protocol dependencies.
