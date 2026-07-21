# Dependency remediation

Baseline `pnpm audit` (2026-07-22) reported 17 advisories: 2 critical, 7 high, 7 moderate, and 1 low. GitHub's earlier snapshot reported 18 alerts; it can lag the lockfile and must be rechecked after push.

| Advisory/package               |               Severity | Installed path and scope                                       | Fixed version      | Action and verification                                                                                                             |
| ------------------------------ | ---------------------: | -------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-9crc-q9x8-hgqq, Vitest    |               critical | direct root development tool, 3.2.4                            | 3.2.6              | pinned 3.2.6; unit suite and builds pass                                                                                            |
| protobufjs advisories          | critical/high/moderate | transitive runtime via `@hashgraph/sdk@2.74.0`, 7.5.4          | 7.6.5              | narrow pnpm override to 7.6.5; Hedera/x402 mock protocol tests pass                                                                 |
| `@grpc/grpc-js` advisory       |                   high | transitive runtime via Hedera SDK, 1.12.6                      | 1.12.7             | narrow override to 1.12.7; builds and tests pass                                                                                    |
| `bn.js` advisory               |               moderate | transitive runtime via Hedera SDK, 5.2.1                       | 5.2.3              | narrow override; resolved graph selects patched 5.2.x; protocol tests pass                                                          |
| `elliptic` GHSA-848j-6mx2-7j84 |                    low | transitive runtime: Hedera SDK -> ethers v5 signing key, 6.6.1 | no patched release | residual risk; keys are server-only, inputs are allowlisted, testnet only, live execution is operator-gated and disabled by default |

The overrides are compatibility-preserving and must be removed when `@hashgraph/sdk` directly requires patched releases. The pinned x402/Hedera major versions were not changed. `pnpm audit --audit-level high` now passes; plain `pnpm audit` reports only the documented low advisory. Lockfile inspection and a frozen install are CI release gates.

No advisory is considered remediated solely from disappearance in a dashboard: the lockfile, dependency paths, tests, and production builds are the evidence. Revisit the residual `elliptic` item on every Hedera SDK upgrade and track it as a narrowly scoped dependency issue.
