# Phase 2 demonstration

The multi-resource command first obtains a strict plan, verifies the exact registered total of
16,000,000 tinybars (0.16 HBAR), checks testnet configuration, credentials, and buyer balance,
then starts local facilitator and resource services. Each resource must independently return
HTTP 402, settle a separate transaction, retry, validate, and return HTTP 200.

Safe console evidence includes resource IDs, plan source, total, status codes, public transaction
IDs, HashScan URLs, delivery state, and synthesis source. It excludes keys, authorization headers,
raw signed transactions, and database credentials. See [HashScan evidence](hashscan-evidence.md)
for the recorded run.
