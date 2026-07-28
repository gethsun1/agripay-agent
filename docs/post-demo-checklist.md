# Post-demo checklist

1. Set `LIVE_PAYMENTS_ENABLED=false` and verify `/api/network/status` reports `false`.
2. Run non-spending reconciliation; never blindly retry an ambiguous transaction.
3. Verify all task receipts and save the three public transaction IDs and HashScan links.
4. Back up the SQLite database and run the backup verification command.
5. Confirm the API, resource server, and facilitator are healthy.
6. Preserve only redacted application logs; do not copy secrets or signed payment payloads.
7. Confirm Nginx and TLS remain healthy.
8. Confirm RD Social and EngageFlow remain active and unchanged.
9. Confirm the production frontend and all five public routes load.
10. Record the deployed Git commit and retain the prior release for rollback.
