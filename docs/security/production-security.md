# Production security model

Public routes expose the site, catalogue, public policy, sanitized receipts, and bounded mock tasks. Live HBAR execution requires a server-side operator session, session-bound CSRF token, explicit confirmation, and `LIVE_PAYMENTS_ENABLED=true`. The kill switch defaults off. Mainnet is unsupported.

Generate the operator hash interactively with `pnpm auth:hash-password`; neither input nor plaintext is printed. Put the resulting hash and a random 32+ character `SESSION_SECRET` only in the host secret environment. Sessions are random, stored as SHA-256 digests in SQLite, HttpOnly, SameSite Strict, Secure under production HTTPS, idle-expiring, absolute-expiring, revocable, and throttled durably by hashed source.

State-changing routes enforce exact-origin CORS and CSRF. CSP disallows inline/eval scripts, framing, object embedding, foreign form targets, and an unrestricted base URI. HSTS is emitted only when production HTTPS is confirmed. Logs redact credentials, cookies, CSRF, keys, signed payloads, and transaction material; questions are represented by a fingerprint and length.

Live limits are durable per hour and supplemented by concurrency and ambiguous-settlement circuit breakers. Buyer, seller, and facilitator account IDs must be distinct. Keep secrets out of Vercel/browser variables, logs, source control, shell history, and support bundles. Rotate a suspected credential immediately, disable live payments, revoke sessions, and reconcile before re-enabling.
