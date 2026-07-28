# Final readiness audit

Audit date: 2026-07-28. This is an internal readiness rubric, not an official Hedera score.

## Score

| Area                       |     Before |      After | Evidence                                                                                                                              |
| -------------------------- | ---------: | ---------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| End-to-end reliability     |      22/25 |      24/25 | Genuine three-resource integration tests, durable recovery, public production services                                                |
| x402 implementation        |      18/20 |      19/20 | Real 402 → exact validation → settle → proof retry → 200, replay and changed-requirement checks                                       |
| Hedera utilization         |      19/20 |      20/20 | Three-role native-HBAR testnet transfers, HashScan and mirror-node evidence                                                           |
| Autonomous-agent value     |      14/15 |      15/15 | Schema-valid Groq plan, registered-resource restriction, deterministic policy/fallback, delivered-only synthesis                      |
| Product and demo           |       5/10 |       9/10 | Public responsive UI, visible lifecycle, rejected-payment view, exact four-minute recording package                                   |
| Open source and submission |       6/10 |       9/10 | Public Apache-2.0 repository, judge-first README, CI/SBOM/security docs, deck and submission copy                                     |
| **Total**                  | **84/100** | **96/100** | One point remains in each of x402, product, and submission pending broader interoperability, final recorded video, and completed form |

## Findings and disposition

### P0

- A prior GitHub runner dependency-install attempt failed transiently; the unchanged baseline later
  passed. The standard pinned Chromium plus required-OS-dependencies install is retained.
- The tracked-file secret scan matched its own workflow pattern. Fixed by excluding only the
  workflow definition while retaining the repository scan.
- Browser task mocks did not answer the CSRF bootstrap request. Fixed with explicit CSRF fixtures.
- Production readiness did not aggregate the protected-resource and facilitator health. Fixed with
  non-spending health endpoints and dependency-aware readiness.

### P1

- README did not provide a first-screen judge journey or compact evidence table. Fixed.
- No one-command production demo preflight. Added `pnpm demo:preflight`.
- No exact recording, pitch-deck, submission-copy, or post-demo package. Added under `docs/`.
- Live-payment status was implicit in the public network response. It is now explicit.
- Narrow-screen hero had an avoidable intrinsic-width risk. Mobile grid children now shrink
  safely and the hero copy wraps deliberately.

### P2 / deferred

- Replace curated agricultural fixtures with live, provenance-scored providers.
- Add wider x402 client interoperability testing when the Hedera implementation stabilizes.
- Consider mainnet only after independent audit and explicit product authorization; current code
  intentionally refuses it.

## Defensible limitations

- Agricultural results are demonstration fixtures and are not agronomic, weather, disease, market,
  or financial advice.
- The public application defaults to mock mode; live testnet spending is operator-gated and
  disabled by default.
- Recorded public transactions prove the genuine payment path. A new testnet run is only necessary
  when the controlled demo environment is deliberately enabled and authenticated.
- Final video URL and builder/team fields must be filled by the submitter after recording.
