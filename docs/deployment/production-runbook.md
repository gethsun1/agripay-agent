# Production deployment runbook

These are preparation artifacts only; Phase 4 does not authorize VPS, Vercel, DNS, mainnet, or live-payment changes.

Use Node 24 and pnpm 10.7.0. Create a locked `agripay` system user, deploy immutable releases beneath `/opt/agripay-agent/releases`, symlink `current`, and keep the SQLite database in `/var/lib/agripay` mode 0600. Copy secrets manually to `/etc/agripay/agent-api.env` mode 0600. Install the systemd, nginx, and logrotate templates after replacing `api.example.invalid`; bind application services only to loopback. Future DNS should point the API hostname to `89.116.31.3`, but do not create it during this phase. Terminate TLS at nginx, then set exact `ALLOWED_ORIGINS` and production HTTPS flags.

Before promotion: frozen install, audit at high severity, format, lint, typecheck, tests, Playwright, production builds, secret scans, DB integrity check, and backup verification. Start with `LIVE_PAYMENTS_ENABLED=false`; verify health/readiness and public mock behavior. Enable live testnet only after operator login, distinct account-role checks, balance review, and an explicit maintenance window.

Back up with an explicit destination: `pnpm db:backup -- /secure/path/backup.sqlite`; verify with `pnpm db:verify-backup -- /secure/path/backup.sqlite`. Restore only offline with `pnpm db:restore -- /secure/path/backup.sqlite --confirm-offline-restore`; the command makes a pre-restore copy and integrity-checks both sides.

Rollback by disabling live payments, stopping the API, repointing `current` to the previous immutable release, restoring only if the schema is incompatible, starting the service, and checking health/readiness. During a payment incident: disable live execution, preserve logs/database, revoke operator sessions, reconcile ambiguous records without creating payments, rotate compromised secrets, and document transaction IDs only in access-controlled evidence.

For Vercel, deploy only `apps/web`; set `VITE_API_URL` to the HTTPS API origin. Never place Hedera keys, Groq keys, password hashes, or session secrets in Vercel/client variables. Configure SPA rewrites and add only the deployed web origin to API CORS.
