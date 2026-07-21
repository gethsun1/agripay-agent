import { describe, expect, it } from "vitest";
import type { PaymentRequirements } from "@agripay/schemas";
import { evaluatePayment, evaluateTask, type PolicyContext } from "./index.js";

const requirements: PaymentRequirements = {
  scheme: "exact",
  network: "hedera-testnet",
  asset: "HBAR",
  maxAmountRequired: "5000000",
  payTo: "0.0.1002",
  resource: "weather-risk",
  description: "Demonstration weather risk",
  expiresAt: "2030-01-01T00:00:00.000Z",
  nonce: "0123456789abcdef",
  extra: { feePayer: "0.0.1003" },
};

const context = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  requirements,
  expectedPriceTinybars: 5_000_000n,
  expectedSeller: "0.0.1002",
  allowedResources: new Set(["weather-risk"]),
  maxResourceTinybars: 10_000_000n,
  maxTaskTinybars: 20_000_000n,
  maxPeriodTinybars: 100_000_000n,
  taskSpentTinybars: 0n,
  periodSpentTinybars: 0n,
  idempotencyKey: "task:weather-risk",
  usedIdempotencyKeys: new Set(),
  now: new Date("2029-01-01T00:00:00.000Z"),
  ...overrides,
});

const changedRequirements = (overrides: Partial<PaymentRequirements>): PaymentRequirements => ({
  ...requirements,
  ...overrides,
});

describe("evaluatePayment", () => {
  it("approves an exact registered purchase", () => {
    expect(evaluatePayment(context()).approved).toBe(true);
  });
  it("rejects an unknown seller", () => {
    expect(evaluatePayment(context({ expectedSeller: "0.0.9" }))).toMatchObject({
      code: "SELLER_DENIED",
    });
  });
  it("rejects a task budget overrun", () => {
    expect(evaluatePayment(context({ taskSpentTinybars: 16_000_000n }))).toMatchObject({
      code: "TASK_BUDGET",
    });
  });
  it("rejects duplicate payment", () => {
    expect(
      evaluatePayment(context({ usedIdempotencyKeys: new Set(["task:weather-risk"]) })),
    ).toMatchObject({ code: "DUPLICATE" });
  });
  it("rejects a changed price", () => {
    expect(evaluatePayment(context({ expectedPriceTinybars: 1n }))).toMatchObject({
      code: "PRICE_CHANGED",
    });
  });
  it("rejects expiry", () => {
    expect(evaluatePayment(context({ now: new Date("2031-01-01T00:00:00.000Z") }))).toMatchObject({
      code: "EXPIRED",
    });
  });
  it("rejects a non-testnet network", () => {
    expect(
      evaluatePayment(
        context({ requirements: changedRequirements({ network: "hedera-mainnet" }) }),
      ),
    ).toMatchObject({ code: "NETWORK_DENIED" });
  });
  it("rejects a non-HBAR asset", () => {
    expect(
      evaluatePayment(context({ requirements: changedRequirements({ asset: "USDC" }) })),
    ).toMatchObject({ code: "ASSET_DENIED" });
  });
  it("rejects a per-resource limit", () => {
    expect(evaluatePayment(context({ maxResourceTinybars: 1n }))).toMatchObject({
      code: "RESOURCE_BUDGET",
    });
  });
  it("rejects a period limit", () => {
    expect(evaluatePayment(context({ periodSpentTinybars: 99_000_000n }))).toMatchObject({
      code: "PERIOD_BUDGET",
    });
  });
  it("rejects too many payments", () => {
    expect(evaluatePayment(context({ paymentCount: 3, maxPaymentsPerTask: 3 }))).toMatchObject({
      code: "PAYMENT_COUNT",
    });
  });
  it("rejects insufficient balance", () => {
    expect(evaluatePayment(context({ availableBalanceTinybars: 1n }))).toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
  });
});

describe("evaluateTask", () => {
  const prices = {
    "weather-risk": 5_000_000n,
    "disease-risk": 7_000_000n,
    "market-intelligence": 4_000_000n,
  } as const;
  const base = {
    resources: ["weather-risk", "disease-risk", "market-intelligence"] as const,
    prices,
    allowedResources: new Set(["weather-risk", "disease-risk", "market-intelligence"] as const),
    maxTaskTinybars: 16_000_000n,
    maxPaymentsPerTask: 3,
    periodSpentTinybars: 0n,
    maxPeriodTinybars: 100_000_000n,
  };
  it("approves an exact three-resource task", () => {
    expect(evaluateTask(base)).toEqual({ approved: true, estimatedTinybars: 16_000_000n });
  });
  it("rejects the whole over-budget task", () => {
    expect(evaluateTask({ ...base, maxTaskTinybars: 15_999_999n })).toMatchObject({
      code: "TASK_BUDGET",
    });
  });
});
