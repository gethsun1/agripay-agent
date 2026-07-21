# Submission checklist

## Product walkthrough

- Landing page explains Question → Plan → 402 → Policy → Hedera → 200 → Intelligence.
- Agent workspace labels demo versus live testnet and shows an exact preflight.
- Live submit is disabled until the maximum-spend confirmation is checked.
- Durable events, partial/failure/ambiguous states, and payment controls are readable.
- Receipt and developer pages show committed evidence without creating tasks.
- About page explains Groq's limited role, deterministic policy, replay protection, and recovery.

## Safety

- Mainnet remains refused.
- No page load, refresh, route, receipt, or developer view initiates payment.
- No key, signed payload, authorization header, database credential, or model reasoning is public.
- Mock receipts never receive fabricated public-ledger links.
- Fixture intelligence is clearly disclosed as demonstration data.

## Verification

- Formatting, ESLint, strict TypeScript, unit/integration/component tests, and builds pass.
- Playwright passes on desktop Chromium and a 375px mobile Chromium profile with mocked APIs.
- Routes `/`, `/agent`, `/receipts`, `/developer`, `/about`, `/health`, and `/ready` are smoke-tested.
- Desktop and mobile screenshots are inspected for overflow, clipping, hierarchy, and focus.
- Tracked-file and full Git-history secret scans pass before push.
