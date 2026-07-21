# Local development

Requirements: Node.js 20+, Corepack, pnpm 10.7.0, and Git. Run `corepack pnpm install`, then
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
