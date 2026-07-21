# ADR 0001: Foundation and x402 compatibility boundary

- Status: Accepted
- Date: 2026-07-21

## Decision

AgriPay Agent is a strict TypeScript pnpm monorepo. The payment implementation targets the
`hedera-dev/x402-hedera` alpha at commit `d11dc65ab12fbdf644f1b2dba40fdd05f5a9ab1`, x402
package 0.6.6, and x402 protocol v1. The reference declares `@hashgraph/sdk` `^2.74.0`;
AgriPay pins 2.74.0 exactly when the payment integration is introduced. The repository requires
Node 18+ and pins pnpm 10.7.0; AgriPay requires Node 20+ and uses the same pnpm version. The
current upstream v2 headers and types are not mixed into the Hedera v1 flow.

Native HBAR is the first asset. USDC is deferred until HBAR settlement is verified. The buyer,
seller, and fee-paying facilitator are separate logical accounts. Signing stays in backend
code. The resource server calls a dedicated facilitator for verification and settlement.

SQLite is selected for durable MVP receipts and replay/idempotency records because it is the
smallest operational dependency. Services will later be isolated systemd units on the VPS;
only the Next.js frontend will run on Vercel. No deployment is authorized by this ADR.

## Consequences

V1 uses `X-PAYMENT` and `X-PAYMENT-RESPONSE`. Protocol-facing schemas must carry
`x402Version: 1`. Any future v2 upgrade requires a new ADR and migration tests. Mock mode is
explicit and cannot emit a HashScan URL or claim on-chain settlement.

## Sources and attribution

The reference is Apache-2.0 licensed. Adapted source, if introduced, will retain the upstream
copyright and NOTICE obligations. No upstream source has been copied in Phase 0.
