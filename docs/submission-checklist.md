# Submission checklist

## Product walkthrough

- Landing page explains Question → Plan → 402 → Policy → Hedera → 200 → Intelligence.
- Agent workspace labels demo versus live testnet and shows an exact preflight.
- Live submit requires operator authentication and exact maximum-spend confirmation.
- Durable events, partial/failure/ambiguous states, and payment controls are readable.
- Receipt and developer pages show committed evidence without creating tasks.
- About page explains Groq's limited role, deterministic policy, replay protection, and recovery.

## Safety

- Mainnet remains refused and live testnet execution defaults off.
- No page load, refresh, route, receipt, or developer view initiates payment.
- No key, signed payload, authorization header, database credential, or model reasoning is public.
- Mock receipts never receive fabricated public-ledger links.
- Fixture intelligence is clearly disclosed as demonstration data.

## Verification and evidence

- Formatting, ESLint, strict TypeScript, unit/integration/component tests, and builds pass.
- Playwright passes on desktop Chromium and a 375px mobile Chromium profile with mocked APIs.
- Routes `/`, `/agent`, `/receipts`, `/developer`, `/about`, `/health`, and `/ready` are smoke-tested.
- Record a mock 402 → settlement → 200 demo and the live-disabled operator boundary.
- Include only sanitized, previously verified testnet receipts and HashScan evidence.
- Dependency audit, tracked-file and full-history secret scans pass before push.
- Review residual dependency risk, rollback, backup/restore, and incident runbooks.
- Confirm no VPS, Vercel, DNS, mainnet, or live payment changed during Phase 4.
- Verify the remote branch matches the final submission SHA.
