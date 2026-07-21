import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PrivateKey } from "@hashgraph/sdk";
import { runWeatherPurchase, storeReceipt } from "@agripay/agent";
import { createFacilitatorServer } from "@agripay/facilitator";
import { loadEnvironmentFile } from "@agripay/payments/provision";
import { createResourceServer } from "@agripay/resource-server";

if (!process.argv.includes("--confirm-live-testnet-spend")) {
  throw new Error("Live test requires --confirm-live-testnet-spend");
}
const base = await loadEnvironmentFile(".env");
const secret = await loadEnvironmentFile(".secrets/hedera-testnet.env");
const env = { ...base, ...secret };
if (env.HEDERA_NETWORK !== "testnet") throw new Error("Live test refuses non-testnet network");
const required = [
  "HEDERA_BUYER_ACCOUNT_ID",
  "HEDERA_BUYER_PRIVATE_KEY",
  "HEDERA_SELLER_ACCOUNT_ID",
  "HEDERA_FACILITATOR_ACCOUNT_ID",
  "HEDERA_FACILITATOR_PRIVATE_KEY",
] as const;
for (const name of required) if (!env[name]) throw new Error(`Missing live test field: ${name}`);

function requiredValue(name: (typeof required)[number]): string {
  const value = env[name];
  if (!value) throw new Error(`Missing live test field: ${name}`);
  return value;
}

const buyer = {
  accountId: requiredValue("HEDERA_BUYER_ACCOUNT_ID"),
  privateKey: requiredValue("HEDERA_BUYER_PRIVATE_KEY"),
};
const facilitator = {
  accountId: requiredValue("HEDERA_FACILITATOR_ACCOUNT_ID"),
  privateKey: requiredValue("HEDERA_FACILITATOR_PRIVATE_KEY"),
};
const servers: Server[] = [];
async function start(server: Server): Promise<string> {
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
      expectedSellerAccountId: requiredValue("HEDERA_SELLER_ACCOUNT_ID"),
      expectedPriceTinybars: 5_000_000n,
      facilitator,
    }),
  );
  const resourceServerUrl = await start(
    createResourceServer({
      sellerAccountId: requiredValue("HEDERA_SELLER_ACCOUNT_ID"),
      facilitatorAccountId: facilitator.accountId,
      facilitatorUrl,
    }),
  );
  const result = await runWeatherPurchase({
    resourceServerUrl,
    facilitatorUrl,
    county: "Nandi",
    crop: "maize",
    buyer,
    sellerAccountId: requiredValue("HEDERA_SELLER_ACCOUNT_ID"),
    facilitatorAccountId: facilitator.accountId,
    maxResourceTinybars: BigInt(env.MAX_RESOURCE_SPEND_TINYBARS ?? "10000000"),
    maxTaskTinybars: BigInt(env.MAX_TASK_SPEND_TINYBARS ?? "30000000"),
    maxPeriodTinybars: BigInt(env.MAX_PERIOD_SPEND_TINYBARS ?? "100000000"),
  });
  if (!result.receipt) throw new Error(`Live x402 lifecycle failed: ${result.error ?? "unknown"}`);
  await storeReceipt(result.receipt);
  console.log(`Initial HTTP status: ${String(result.initialStatus)}`);
  console.log(`Policy decision: ${result.receipt.policyDecision}`);
  console.log(`Final HTTP status: ${String(result.finalStatus)}`);
  console.log(`Transaction ID: ${result.receipt.transactionId}`);
  console.log(`HashScan: ${result.receipt.hashscanUrl ?? "unavailable"}`);
  console.log(`Buyer: ${result.receipt.buyerAccountId}`);
  console.log(`Seller: ${result.receipt.sellerAccountId}`);
  console.log(`Facilitator: ${result.receipt.facilitatorAccountId}`);
  console.log(
    `Amount: ${result.receipt.amountHbar} HBAR (${result.receipt.amountTinybars} tinybars)`,
  );
  console.log(`Delivery: ${result.receipt.deliveryState}`);
} finally {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
}
