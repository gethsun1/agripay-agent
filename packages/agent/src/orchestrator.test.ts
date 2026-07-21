import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PrivateKey } from "@hashgraph/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createFacilitatorServer } from "@agripay/facilitator";
import { createResourceServer } from "@agripay/resource-server";
import { DurableStore } from "@agripay/storage";
import { runTask } from "./index.js";
const servers: Server[] = [];
async function start(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) =>
          server.close(() => {
            resolve();
          }),
        ),
    ),
  );
});
async function setup() {
  const key = PrivateKey.generateECDSA(),
    buyer = { accountId: "0.0.1001", privateKey: key.toStringDer() },
    facilitator = { accountId: "0.0.1003", privateKey: "mock" };
  let sequence = 0;
  const fs = new DurableStore(":memory:");
  const rs = new DurableStore(":memory:");
  const facilitatorUrl = await start(
    createFacilitatorServer({
      buyerAccountId: buyer.accountId,
      buyerPublicKey: key.publicKey.toStringDer(),
      expectedSellerAccountId: "0.0.1002",
      expectedPriceTinybars: 5_000_000n,
      facilitator,
      store: fs,
      settle: () =>
        Promise.resolve({ state: "settled", transactionId: `mock-${String(++sequence)}` }),
    }),
  );
  const resourceServerUrl = await start(
    createResourceServer({
      sellerAccountId: "0.0.1002",
      facilitatorAccountId: facilitator.accountId,
      facilitatorUrl,
      store: rs,
    }),
  );
  return { buyer, facilitator, facilitatorUrl, resourceServerUrl, fs, rs };
}
describe("multi-resource orchestration", () => {
  it("completes three independent 402 -> settlement -> 200 purchases", async () => {
    const env = await setup(),
      store = new DurableStore(":memory:");
    const result = await runTask({
      question: "Use rain, disease and market price to advise planting and selling maize in Nandi",
      store,
      resourceServerUrl: env.resourceServerUrl,
      facilitatorUrl: env.facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer: env.buyer,
      sellerAccountId: "0.0.1002",
      facilitatorAccountId: env.facilitator.accountId,
      maxResourceTinybars: 7_000_000n,
      maxTaskTinybars: 16_000_000n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result).toMatchObject({
      state: "completed",
      estimatedTinybars: "16000000",
      spentTinybars: "16000000",
      synthesisSource: "deterministic-fallback",
    });
    expect(result.resources.map((r) => [r.resourceId, r.initialStatus, r.finalStatus])).toEqual([
      ["weather-risk", 402, 200],
      ["disease-risk", 402, 200],
      ["market-intelligence", 402, 200],
    ]);
    expect(new Set(result.resources.map((r) => r.receipt?.transactionId)).size).toBe(3);
    expect(store.listEvents(result.taskId).map((e) => e.event_type)).toEqual(
      expect.arrayContaining([
        "preflight_policy_approved",
        "http_402_received",
        "payment_settled",
        "resource_validated",
        "task_completed",
      ]),
    );
    env.fs.close();
    env.rs.close();
    store.close();
  });
  it("rejects an over-budget complete task before any payment", async () => {
    const env = await setup(),
      store = new DurableStore(":memory:");
    const result = await runTask({
      question: "rain disease market price",
      store,
      resourceServerUrl: env.resourceServerUrl,
      facilitatorUrl: env.facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer: env.buyer,
      sellerAccountId: "0.0.1002",
      facilitatorAccountId: env.facilitator.accountId,
      maxResourceTinybars: 7_000_000n,
      maxTaskTinybars: 15_999_999n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result).toMatchObject({ state: "failed", resources: [] });
    expect(store.listPurchases(result.taskId)).toHaveLength(0);
    env.fs.close();
    env.rs.close();
    store.close();
  });
});
