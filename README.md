# AgriPay Agent

> Autonomous intelligence, paid one insight at a time.

AgriPay Agent is an autonomous agricultural-intelligence procurement agent built for Hedera's
x402 bounty. It plans which registered insights a question needs, evaluates each payment with
deterministic spending controls, pays on Hedera testnet, retries protected HTTP resources, and
records public receipts.

Phase 2 expands the genuine native-HBAR slice into an autonomous three-resource workflow:
weather risk (5,000,000 tinybars), disease risk (7,000,000), and market intelligence
(4,000,000). Groq proposes a strict resource-only plan; the immutable registry and deterministic
policy retain all payment authority. SQLite makes task state, replay protection, receipts, and
recovery durable. Mock results remain labelled and never receive HashScan links.

Phase 3 adds a premium responsive web application that makes this lifecycle inspectable without
turning navigation or refresh into a payment action. It includes a safety-gated agent workspace,
durable event timeline, receipt explorer, sanitized developer inspection, architecture page, and
committed verified-evidence mode.

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
- `packages/storage`: SQLite migrations, task state, replay protection, backup and restore
- `packages/planner`: strict Groq planner, safe discovery, synthesis, and deterministic fallback
- `packages/agent`: durable multi-resource orchestration and sanitized receipts
- `apps/agent-api`: bounded task, timeline, receipt, policy, catalogue, and health APIs
- `apps/web`: React/Vite frontend, component tests, and deterministic Playwright coverage
- `apps/resource-server`: three protected fixture resources
- `apps/facilitator`: verification, replay protection, and settlement
- `docs/adr`: compatibility and architecture decisions

See [local development](docs/local-development.md) and the [architecture](docs/architecture.md).
Public testnet proof is recorded in [HashScan evidence](docs/hashscan-evidence.md).

## Production

The production API is available at <https://agripay-api.duckdns.org>. It runs in bounded mock mode with live Hedera payments disabled by default. The API, protected resource server, and facilitator run as separate non-root systemd services bound to loopback. See the [Contabo runbook](docs/deployment/contabo.md), [Vercel runbook](docs/deployment/vercel.md), and [rollback procedure](docs/deployment/rollback.md).

## Frontend routes

- `/` — product narrative, catalogue, lifecycle and verified evidence
- `/agent` — question composer, exact preflight, task timeline and payment controls
- `/receipts` — bounded public receipt search and detail inspection
- `/developer` — human and sanitized-JSON x402 inspection
- `/about` — architecture, policy boundary, recovery and roadmap

## Disclosure

Agricultural outputs use curated demonstration data. They are not live meteorological,
agronomic, disease-surveillance, financial, or market advice.

## License and attribution

Apache-2.0. The planned Hedera integration targets `hedera-dev/x402-hedera` commit
`d11dc65ab12fbdf644f1b2dba40fdd05f5a9ab1`, also Apache-2.0. See the ADR before modifying
protocol dependencies.
