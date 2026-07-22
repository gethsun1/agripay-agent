# Vercel deployment

Project: `gethsun1s-projects/agripay-agent`. The repository root is the project root; `vercel.json` builds only `@agripay/web` and publishes `apps/web/dist`. The sole browser environment variable is `VITE_API_URL=https://agripay-api.duckdns.org`.

GitHub production deployments use the connected `main` branch. Manual fallback:

```bash
vercel deploy --prod --yes --env VITE_API_URL=https://agripay-api.duckdns.org
```

Never add Groq, Hedera, operator, session, or database secrets. Production credentialed CORS accepts only the exact production origin; preview origins are intentionally excluded. Cross-site operator cookies are Secure, HttpOnly, SameSite=None, with exact Origin enforcement and session-bound CSRF. Public mock and read-only routes do not require operator authentication.
