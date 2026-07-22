# Judging guide

Start at <https://agripay-agent.vercel.app> and follow Question → Plan → HTTP 402 → deterministic policy → mock settlement → HTTP 200 → synthesis. The public backend health endpoint is <https://agripay-api.duckdns.org/health>.

The production default is deliberately safe: public questions exercise the complete protocol shape with mock transaction IDs and no fabricated HashScan links; anonymous users cannot enable live execution. Real historical testnet evidence is separately identified in [HashScan evidence](hashscan-evidence.md). Operator sessions are server-side, CSRF-bound, throttled, and protected by an independent kill switch.

Strongest evidence: three independently priced resources, exact integer-tinybar policy, durable idempotency and recovery, sanitized receipts, redacted structured logs, a non-spending reconciliation path, and an isolated non-root production architecture.
