# Phase 2 demonstration

The multi-resource command first obtains a strict plan, verifies the exact registered total of
16,000,000 tinybars (0.16 HBAR), checks testnet configuration, credentials, and buyer balance,
then starts local facilitator and resource services. Each resource must independently return
HTTP 402, settle a separate transaction, retry, validate, and return HTTP 200.

Safe console evidence includes resource IDs, plan source, total, status codes, public transaction
IDs, HashScan URLs, delivery state, and synthesis source. It excludes keys, authorization headers,
raw signed transactions, and database credentials. See [HashScan evidence](hashscan-evidence.md)
for the recorded run.

## Frontend demonstration

Run `pnpm web:dev`, open `http://127.0.0.1:3000`, and follow the landing-page CTA. Demo mode is
explicitly labelled and uses no real payment. Switching to live testnet reveals an exact maximum
spend checkbox; the submit action remains disabled until confirmation. Ordinary visual and E2E
tests intercept API calls with deterministic fixtures and never contact Hedera.

Use `/receipts` and `/developer` for the strongest judge walkthrough: both default to committed
historical evidence and are entirely read-only.

## Production walkthrough

Open the production frontend, confirm API status, and submit the combined Nandi maize prompt in Demo mode. Verify three 402 stages, three mock settlements, three delivered resources, and the completed synthesis. Show that mock receipts omit explorer links, then open `/receipts` to distinguish committed historical testnet evidence. Finally, switch to Live Testnet and demonstrate that authentication, exact confirmation, and the server-side disabled kill switch prevent execution. Page loads and refreshes never initiate payments.
