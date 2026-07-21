# Security policy

Please report vulnerabilities privately to the repository maintainers rather than opening a
public issue. Do not include real private keys or credentials in reports.

The primary threats are key and log leakage, prompt injection, arbitrary URL or recipient
substitution, price and budget manipulation, wrong-network settlement, replay, duplicate
payment, ambiguous settlement, and denial-of-wallet attacks. Keys remain backend-only;
resource identity, URL, recipient, and pricing are server-controlled; all purchases pass the
deterministic policy engine; live mode is testnet-only; and settlement is not inferred from UI
or delivery success.
