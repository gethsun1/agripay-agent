/* global AbortSignal, fetch */
import { connect } from "node:tls";
import { URL } from "node:url";

const api = process.env.PUBLIC_API_URL ?? "https://agripay-api.duckdns.org";
const expectedAccounts = ["0.0.9676580", "0.0.9676582", "0.0.9676583"];
const get = async (path) => {
  const response = await fetch(new URL(path, api), { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${path} returned ${String(response.status)}`);
  return response.json();
};
const tls = await new Promise((resolve, reject) => {
  const socket = connect(443, new URL(api).hostname, { servername: new URL(api).hostname }, () => {
    const certificate = socket.getPeerCertificate();
    socket.end();
    resolve({ authorized: socket.authorized, validTo: certificate.valid_to });
  });
  socket.once("error", reject);
});
const [health, ready, network, policy, catalogue] = await Promise.all([
  get("/health"),
  get("/ready"),
  get("/api/network/status"),
  get("/api/policies/public"),
  get("/api/resources/catalogue"),
]);
if (network.network !== "hedera-testnet" || network.mainnetAllowed !== false)
  throw new Error("Testnet invariant failed");
if (network.livePaymentsEnabled !== false) throw new Error("Live payments must be disabled");
if (
  JSON.stringify([
    network.buyerAccountId,
    network.sellerAccountId,
    network.facilitatorAccountId,
  ]) !== JSON.stringify(expectedAccounts)
)
  throw new Error("Account-role invariant failed");
if (policy.maxTaskTinybars !== "16000000" || policy.maxPaymentsPerTask !== 3)
  throw new Error("Policy limit invariant failed");
if (!Array.isArray(catalogue) || catalogue.length !== 3)
  throw new Error("Catalogue invariant failed");
const balances = await Promise.all(
  expectedAccounts.map(async (account) => {
    const response = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/balances?account.id=${account}&limit=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(`Mirror balance unavailable for ${account}`);
    const body = await response.json();
    return { account, tinybars: body.balances?.[0]?.balance ?? null };
  }),
);
const evidence = await fetch(
  "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784671645-343987679",
  { signal: AbortSignal.timeout(10_000) },
);
if (!evidence.ok) throw new Error("Recorded mirror evidence is unavailable");
process.stdout.write(
  `${JSON.stringify({ status: "ready", health, ready, network, policy: { maxTaskTinybars: policy.maxTaskTinybars, maxPaymentsPerTask: policy.maxPaymentsPerTask }, resources: catalogue.length, tls, balances, mirrorEvidence: "reachable", groq: process.env.GROQ_API_KEY ? "configured-locally" : "server-managed" }, null, 2)}\n`,
);
