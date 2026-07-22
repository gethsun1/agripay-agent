# Contabo deployment

Production backend: `https://agripay-api.duckdns.org`; deployed release baseline: `f5722393bbc83d5fbe776e79805bdf31f8f90c17`.

The isolated deployment uses Linux user `agripay`, `/opt/agripay-agent/current`, Node 24 at `/opt/agripay-node`, environment files in `/etc/agripay-agent`, databases in `/var/lib/agripay-agent`, verified backups in `/var/lib/agripay-agent/backups`, and logs in `/var/log/agripay-agent`. Services are `agripay-agent-api.service` on `127.0.0.1:3001`, `agripay-resource.service` on `127.0.0.1:3002`, and `agripay-facilitator.service` on `127.0.0.1:3003`. Only the API is proxied publicly by `/etc/nginx/sites-available/agripay-api.duckdns.org`.

Operations:

```bash
systemctl status agripay-agent-api agripay-resource agripay-facilitator
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3001/ready
journalctl -u agripay-agent-api --since today
sudo -u agripay env DATABASE_URL=/var/lib/agripay-agent/api.sqlite /opt/agripay-node/bin/node /opt/agripay-agent/current/packages/storage/dist/cli.js check
sudo -u agripay env DATABASE_URL=/var/lib/agripay-agent/api.sqlite /opt/agripay-node/bin/node /opt/agripay-agent/current/packages/storage/dist/cli.js backup /var/lib/agripay-agent/backups/api-$(date +%F).sqlite
nginx -t
certbot renew --dry-run
```

Live execution starts disabled. Never deploy the bootstrap key, expose ports 3001–3003, or publish facilitator routes. Reconciliation is testnet-only and never creates a payment: load only the buyer/seller account IDs and database location, then run `pnpm payments:reconcile` as `agripay`.
