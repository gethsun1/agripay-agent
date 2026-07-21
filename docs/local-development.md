# Local development

Requirements: Node.js 24+, Corepack, pnpm 10.7.0, and Git. Node 24 is required for built-in
SQLite. Run `corepack pnpm install`, then
`corepack pnpm check`.

Copy `.env.example` to `.env` and keep it local. Mock mode requires no credentials. For live
testnet work, place ECDSA testnet account IDs and private keys directly in the ignored `.env`;
never paste them into chat or expose them as `NEXT_PUBLIC_*` variables. Live tests are opt-in
with `pnpm test:hedera:testnet` and refuse any network other than testnet.

Provision roles with `pnpm hedera:provision -- --dry-run`, review the redacted preview, then use
`pnpm hedera:provision -- --confirm-testnet-account-creation`. This writes
`.secrets/hedera-testnet.env` atomically with directory mode 700 and file mode 600. Reruns are
refused when that state exists.

Run one live purchase explicitly with:

```bash
pnpm test:hedera:testnet -- --confirm-live-testnet-spend
```

This command is excluded from ordinary CI and refuses mainnet or missing role credentials.

Discover currently available Groq models without printing credentials with `pnpm groq:models`.
The configured model is `GROQ_MODEL`; provider failure activates a reason-coded deterministic
fallback. Apply SQLite migrations with `pnpm db:migrate`. Use `pnpm db:backup -- <path>` and
`pnpm db:restore -- <path>` during maintenance; stop writers before restore and retain the
original database until verification succeeds.

The three-resource demonstration is separately opt-in:

```bash
pnpm demo:hedera:multi-resource -- --confirm-live-testnet-spend
```

It refuses non-testnet configuration, a task maximum other than 16,000,000 tinybars, missing
credentials, insufficient balance, or a dry-run plan that does not contain exactly three
resources. It is not run by CI.

## Web application

Start the API on port 3001 and run `pnpm web:dev`. The Vite development server proxies `/api`,
`/health`, and `/ready`; set the public-only `VITE_API_URL` when using a different API origin.
Never place keys or database credentials in a `VITE_*` variable.

The frontend defaults to demo mode. Live testnet mode requires an explicit checkbox confirming
the exact displayed maximum, and the API independently rejects missing or mismatched confirmation.
Refresh, receipt inspection, developer inspection, and polling are read-only. Public task IDs are
kept in the URL for durable recovery and are not written to browser storage.

Run component tests with `pnpm test` and deterministic browser tests with `pnpm test:e2e` after
installing Playwright's Chromium runtime dependencies. No E2E route is permitted to make a real
Hedera payment.
