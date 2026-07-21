import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { AccountBalanceQuery, PrivateKey } from "@hashgraph/sdk";
import { runTask } from "@agripay/agent";
import { createFacilitatorServer } from "@agripay/facilitator";
import { createTestnetClient } from "@agripay/payments";
import { loadEnvironmentFile } from "@agripay/payments/provision";
import { planQuestion } from "@agripay/planner";
import { createResourceServer } from "@agripay/resource-server";
import { DurableStore } from "@agripay/storage";

if (!process.argv.includes("--confirm-live-testnet-spend"))
  throw new Error("Live multi-resource demo requires --confirm-live-testnet-spend");
const base = await loadEnvironmentFile(".env"),
  secret = await loadEnvironmentFile(".secrets/hedera-testnet.env"),
  env = { ...base, ...secret };
if (env.HEDERA_NETWORK !== "testnet") throw new Error("Live demo refuses non-testnet network");
const required = [
  "HEDERA_BUYER_ACCOUNT_ID",
  "HEDERA_BUYER_PRIVATE_KEY",
  "HEDERA_SELLER_ACCOUNT_ID",
  "HEDERA_FACILITATOR_ACCOUNT_ID",
  "HEDERA_FACILITATOR_PRIVATE_KEY",
] as const;
for (const name of required) if (!env[name]) throw new Error(`Missing live demo field: ${name}`);
const value = (name: (typeof required)[number]) => {
  const found = env[name];
  if (!found) throw new Error(`Missing ${name}`);
  return found;
};
const question =
  "For maize in Nandi, combine planting weather, disease scouting and market price and demand into a decision brief.";
const groq = {
  ...(env.GROQ_API_KEY ? { apiKey: env.GROQ_API_KEY } : {}),
  ...(env.GROQ_MODEL ? { model: env.GROQ_MODEL } : {}),
};
const planning = await planQuestion(question, groq);
const ids = planning.plan.resources.map((r) => r.resourceId);
const requiredIds = ["weather-risk", "disease-risk", "market-intelligence"];
if (!requiredIds.every((id) => ids.includes(id as (typeof ids)[number])) || ids.length !== 3)
  throw new Error("Dry-run plan did not select exactly the three demonstration resources");
const estimated = 16_000_000n,
  maxTask = BigInt(env.MAX_TASK_SPEND_TINYBARS ?? "16000000");
if (maxTask !== estimated)
  throw new Error(
    `Configured task maximum must equal dry-run total ${estimated.toString()} tinybars`,
  );
console.log(`User question: ${question}`);
console.log(`Plan source: ${planning.planSource}`);
console.log(`Selected resources: ${ids.join(", ")}`);
console.log(`Preflight estimated total: ${estimated.toString()} tinybars (0.16 HBAR)`);
const buyer = {
    accountId: value("HEDERA_BUYER_ACCOUNT_ID"),
    privateKey: value("HEDERA_BUYER_PRIVATE_KEY"),
  },
  facilitator = {
    accountId: value("HEDERA_FACILITATOR_ACCOUNT_ID"),
    privateKey: value("HEDERA_FACILITATOR_PRIVATE_KEY"),
  };
const client = createTestnetClient();
try {
  const balance = await new AccountBalanceQuery().setAccountId(buyer.accountId).execute(client);
  if (BigInt(balance.hbars.toTinybars().toString()) < estimated + 3_000_000n)
    throw new Error("Buyer balance is insufficient for payments plus bounded fees");
} finally {
  client.close();
}
const taskStore = new DurableStore(env.DATABASE_URL ?? "data/phase2-demo.sqlite");
const facilitatorStore = new DurableStore("data/phase2-facilitator.sqlite");
const resourceStore = new DurableStore("data/phase2-resource.sqlite");
const stores = [taskStore, facilitatorStore, resourceStore];
const servers: Server[] = [];
async function start(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
}
try {
  const facilitatorUrl = await start(
    createFacilitatorServer({
      buyerAccountId: buyer.accountId,
      buyerPublicKey: PrivateKey.fromStringECDSA(buyer.privateKey).publicKey.toStringDer(),
      expectedSellerAccountId: value("HEDERA_SELLER_ACCOUNT_ID"),
      expectedPriceTinybars: 5_000_000n,
      facilitator,
      store: facilitatorStore,
    }),
  );
  const resourceServerUrl = await start(
    createResourceServer({
      sellerAccountId: value("HEDERA_SELLER_ACCOUNT_ID"),
      facilitatorAccountId: facilitator.accountId,
      facilitatorUrl,
      store: resourceStore,
    }),
  );
  const result = await runTask({
    question,
    planningResult: planning,
    groq,
    store: taskStore,
    resourceServerUrl,
    facilitatorUrl,
    county: "Nandi",
    crop: "maize",
    buyer,
    sellerAccountId: value("HEDERA_SELLER_ACCOUNT_ID"),
    facilitatorAccountId: facilitator.accountId,
    maxResourceTinybars: 7_000_000n,
    maxTaskTinybars: maxTask,
    maxPeriodTinybars: BigInt(env.MAX_PERIOD_SPEND_TINYBARS ?? "100000000"),
    maxPaymentsPerTask: 3,
  });
  for (const item of result.resources) {
    console.log(
      `${item.resourceId}: HTTP ${item.initialStatus.toString()} -> ${item.finalStatus.toString()}, ${item.receipt?.amountTinybars ?? "0"} tinybars, ${item.receipt?.transactionId ?? item.error ?? "unsettled"}`,
    );
    if (item.receipt?.hashscanUrl)
      console.log(`${item.resourceId} HashScan: ${item.receipt.hashscanUrl}`);
  }
  console.log(
    `Policy decision: ${result.estimatedTinybars === estimated.toString() ? "approved" : "rejected"}`,
  );
  console.log(`Final task status: ${result.state}`);
  console.log(`Total paid: ${result.spentTinybars} tinybars`);
  console.log(`Synthesis: ${result.synthesisSource ?? "not-run"}`);
  if (
    result.state !== "completed" ||
    result.resources.some((r) => r.initialStatus !== 402 || r.finalStatus !== 200) ||
    result.spentTinybars !== estimated.toString()
  )
    throw new Error("Live multi-resource acceptance criteria failed");
} finally {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) =>
          server.close(() => {
            resolve();
          }),
        ),
    ),
  );
  stores.forEach((store) => {
    store.close();
  });
}
