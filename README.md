# AgriPay Agent

> Autonomous intelligence, paid one insight at a time.

AgriPay Agent is an autonomous agricultural-intelligence procurement agent built for Hedera's
x402 bounty. It plans which registered insights a question needs, evaluates each payment with
deterministic spending controls, pays on Hedera testnet, retries protected HTTP resources, and
records public receipts.

Phase 1 provides a genuine native-HBAR testnet vertical slice: protected weather fixture,
HTTP 402 challenge, deterministic policy evaluation, buyer signature, facilitator verification
and settlement, HTTP retry, delivered data, and a sanitized public receipt. Mock results remain
labelled and never receive HashScan links.

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
- `packages/payments`: strict Hedera exact-payment and provisioning code
- `packages/agent`: deterministic buyer lifecycle and sanitized receipts
- `apps/resource-server`: protected weather resource
- `apps/facilitator`: verification, replay protection, and settlement
- `docs/adr`: compatibility and architecture decisions

See [local development](docs/local-development.md) and the [architecture](docs/architecture.md).
Public testnet proof is recorded in [HashScan evidence](docs/hashscan-evidence.md).

## Disclosure

Agricultural outputs use curated demonstration data. They are not live meteorological,
agronomic, disease-surveillance, financial, or market advice.

## License and attribution

Apache-2.0. The planned Hedera integration targets `hedera-dev/x402-hedera` commit
`d11dc65ab12fbdf644f1b2dba40fdd05f5a9ab1`, also Apache-2.0. See the ADR before modifying
protocol dependencies.
