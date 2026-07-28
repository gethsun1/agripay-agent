import { afterEach, describe, expect, it } from "vitest";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PrivateKey } from "@hashgraph/sdk";
import { runWeatherPurchase } from "@agripay/agent";
import { createFacilitatorServer } from "@agripay/facilitator";
import { createPaymentPayload } from "@agripay/payments";
import { paymentRequiredSchema } from "@agripay/schemas";
import { createResourceServer } from "./index.js";

const servers: Server[] = [];
const buyerKey = PrivateKey.generateECDSA();
const buyer = { accountId: "0.0.1001", privateKey: buyerKey.toStringDer() };
const sellerAccountId = "0.0.1002";
const facilitatorAccountId = "0.0.1003";

async function start(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(address.port)}`;
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

async function setup(
  settlement: "settled" | "failed" | "ambiguous" = "settled",
): Promise<{ resourceUrl: string; facilitatorUrl: string }> {
  const facilitatorUrl = await start(
    createFacilitatorServer({
      buyerAccountId: buyer.accountId,
      buyerPublicKey: buyerKey.publicKey.toStringDer(),
      expectedSellerAccountId: sellerAccountId,
      expectedPriceTinybars: 5_000_000n,
      facilitator: { accountId: facilitatorAccountId, privateKey: "unused-in-mock" },
      settle: () =>
        Promise.resolve(
          settlement === "settled"
            ? { state: "settled", transactionId: "mock-settlement-no-hashscan" }
            : settlement === "ambiguous"
              ? { state: "ambiguous", reason: "mock_ambiguous" }
              : { state: "failed", reason: "mock_refusal" },
        ),
    }),
  );
  const resourceUrl = await start(
    createResourceServer({ sellerAccountId, facilitatorAccountId, facilitatorUrl }),
  );
  return { resourceUrl, facilitatorUrl };
}

describe("weather x402 vertical slice", () => {
  it("reports both resource and facilitator health without spending", async () => {
    const { resourceUrl, facilitatorUrl } = await setup();
    expect(await (await fetch(`${resourceUrl}/health`)).json()).toEqual({ status: "ok" });
    expect(await (await fetch(`${facilitatorUrl}/health`)).json()).toEqual({ status: "ok" });
  });

  it("validates required query parameters", async () => {
    const { resourceUrl } = await setup();
    const response = await fetch(`${resourceUrl}/api/resources/weather-risk?county=Nandi`);
    expect(response.status).toBe(400);
  });

  it("returns a genuine unpaid HTTP 402 with valid testnet HBAR requirements", async () => {
    const { resourceUrl } = await setup();
    const response = await fetch(
      `${resourceUrl}/api/resources/weather-risk?county=Nandi&crop=maize`,
    );
    expect(response.status).toBe(402);
    const challenge = paymentRequiredSchema.parse(await response.json());
    expect(challenge.accepts[0]).toMatchObject({
      network: "hedera-testnet",
      asset: "HBAR",
      payTo: sellerAccountId,
      maxAmountRequired: "5000000",
    });
  });

  it.each([
    ["disease-risk", "crop", "7000000"],
    ["market-intelligence", "commodity", "4000000"],
  ])("protects %s with its registered price", async (resource, param, price) => {
    const { resourceUrl } = await setup();
    const response = await fetch(
      `${resourceUrl}/api/resources/${resource}?county=Nandi&${param}=maize`,
    );
    expect(response.status).toBe(402);
    expect(paymentRequiredSchema.parse(await response.json()).accepts[0]).toMatchObject({
      resource,
      maxAmountRequired: price,
    });
  });

  it("completes the mocked 402-policy-settlement-retry-200 lifecycle", async () => {
    const { resourceUrl, facilitatorUrl } = await setup();
    const result = await runWeatherPurchase({
      resourceServerUrl: resourceUrl,
      facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer,
      sellerAccountId,
      facilitatorAccountId,
      maxResourceTinybars: 10_000_000n,
      maxTaskTinybars: 20_000_000n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result).toMatchObject({ initialStatus: 402, finalStatus: 200 });
    expect(result.receipt).toMatchObject({ deliveryState: "delivered", amountHbar: "0.05" });
    expect(result.receipt).not.toHaveProperty("hashscanUrl");
    expect(result.data?.provenance).toBe("curated demonstration fixture");
  });

  it("rejects over-budget purchases before signing", async () => {
    const { resourceUrl, facilitatorUrl } = await setup();
    const result = await runWeatherPurchase({
      resourceServerUrl: resourceUrl,
      facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer,
      sellerAccountId,
      facilitatorAccountId,
      maxResourceTinybars: 10_000_000n,
      maxTaskTinybars: 1n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result).toMatchObject({ finalStatus: 402, error: "TASK_BUDGET" });
    expect(result.events.at(-1)?.state).toBe("policy_rejected");
  });

  it("does not deliver when facilitator settlement fails", async () => {
    const { resourceUrl, facilitatorUrl } = await setup("failed");
    const result = await runWeatherPurchase({
      resourceServerUrl: resourceUrl,
      facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer,
      sellerAccountId,
      facilitatorAccountId,
      maxResourceTinybars: 10_000_000n,
      maxTaskTinybars: 20_000_000n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result.finalStatus).toBe(402);
    expect(result.receipt).toBeUndefined();
  });

  it("records ambiguous settlement without delivering", async () => {
    const { resourceUrl, facilitatorUrl } = await setup("ambiguous");
    const result = await runWeatherPurchase({
      resourceServerUrl: resourceUrl,
      facilitatorUrl,
      county: "Nandi",
      crop: "maize",
      buyer,
      sellerAccountId,
      facilitatorAccountId,
      maxResourceTinybars: 10_000_000n,
      maxTaskTinybars: 20_000_000n,
      maxPeriodTinybars: 100_000_000n,
    });
    expect(result).toMatchObject({ finalStatus: 503, error: "ambiguous_settlement" });
    expect(result.receipt).toBeUndefined();
  });

  it("rejects a replayed payment at the facilitator", async () => {
    const { resourceUrl, facilitatorUrl } = await setup();
    const unpaid = await fetch(`${resourceUrl}/api/resources/weather-risk?county=Nandi&crop=maize`);
    const challenge = paymentRequiredSchema.parse(await unpaid.json()).accepts.at(0);
    if (!challenge) throw new Error("Missing payment requirement");
    const payload = await createPaymentPayload(buyer, challenge);
    const body = JSON.stringify({ paymentPayload: payload, paymentRequirements: challenge });
    const first = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const second = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ reason: "replay_detected" });
  });
});
