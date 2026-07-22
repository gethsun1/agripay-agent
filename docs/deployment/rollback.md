# Production rollback

1. Set `LIVE_PAYMENTS_ENABLED=false` in `/etc/agripay-agent/api.env` and restart only `agripay-agent-api`.
2. Stop the three AgriPay units. Do not stop Nginx or unrelated services.
3. Repoint `/opt/agripay-agent/current` to the previous verified release.
4. Run database integrity checks; do not restore unless the release is schema-incompatible.
5. Start facilitator, resource, then API; verify loopback health and public HTTPS.
6. If removing the deployment, disable only `/etc/nginx/sites-enabled/agripay-api.duckdns.org`, validate Nginx, and reload it.

For a database rollback, stop all AgriPay units and use `restore <verified-backup> --confirm-offline-restore`. The command preserves a pre-restore copy. Validate restoration against a separate temporary path whenever possible; never perform a destructive restore merely as a test.

After rollback, verify RD Social and EngageFlow public endpoints, their systemd units, memory, disk, listening ports, and `nginx -t`.
