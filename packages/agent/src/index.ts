import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { RESOURCE_REGISTRY } from "@agripay/fixtures";
import {
  createPaymentPayload,
  hashscanTransactionUrl,
  type HederaCredentials,
} from "@agripay/payments";
import { evaluatePayment } from "@agripay/policy";
import {
  paymentRequiredSchema,
  weatherRiskSchema,
  type ResourceId,
  type WeatherRisk,
} from "@agripay/schemas";

export type LifecycleState =
  | "created"
  | "requesting_resource"
  | "payment_required"
  | "evaluating_policy"
  | "policy_rejected"
  | "payment_prepared"
  | "verifying"
  | "settling"
  | "settled"
  | "resource_retrying"
  | "delivered"
  | "failed"
  | "ambiguous";

export interface LifecycleEvent {
  state: LifecycleState;
  timestamp: string;
  detail: string;
}

export interface PaymentReceipt {
  taskId: string;
  resourceId: ResourceId;
  county: string;
  crop: string;
  buyerAccountId: string;
  sellerAccountId: string;
  facilitatorAccountId: string;
  network: "hedera-testnet";
  asset: "HBAR";
  amountTinybars: string;
  amountHbar: string;
  paymentRequiredAt: string;
  policyDecision: "approved";
  settlementState: "settled";
  transactionId: string;
  hashscanUrl?: string;
  deliveryState: "delivered";
  correlationId: string;
}

export interface PurchaseResult {
  initialStatus: number;
  finalStatus: number;
  events: LifecycleEvent[];
  receipt?: PaymentReceipt;
  data?: WeatherRisk;
  error?: string;
}

export interface PurchaseOptions {
  resourceServerUrl: string;
  facilitatorUrl: string;
  county: string;
  crop: string;
  buyer: HederaCredentials;
  sellerAccountId: string;
  facilitatorAccountId: string;
  maxResourceTinybars: bigint;
  maxTaskTinybars: bigint;
  maxPeriodTinybars: bigint;
  taskSpentTinybars?: bigint;
  periodSpentTinybars?: bigint;
  usedIdempotencyKeys?: ReadonlySet<string>;
  now?: () => Date;
}

function formatHbar(tinybars: bigint): string {
  const negative = tinybars < 0n;
  const digits = (negative ? -tinybars : tinybars).toString().padStart(9, "0");
  const whole = digits.slice(0, -8);
  const fraction = digits.slice(-8).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export async function runWeatherPurchase(options: PurchaseOptions): Promise<PurchaseResult> {
  const taskId = randomUUID();
  const correlationId = randomUUID();
  const events: LifecycleEvent[] = [];
  const now = options.now ?? (() => new Date());
  const event = (state: LifecycleState, detail: string): void => {
    events.push({ state, timestamp: now().toISOString(), detail });
  };
  event("created", "Task created");
  const endpoint = new URL("/api/resources/weather-risk", options.resourceServerUrl);
  endpoint.searchParams.set("county", options.county);
  endpoint.searchParams.set("crop", options.crop);
  event("requesting_resource", "Requesting registered weather resource");
  const unpaid = await fetch(endpoint, { headers: { "x-correlation-id": correlationId } });
  if (unpaid.status !== 402) {
    event("failed", "Protected resource did not return HTTP 402");
    return {
      initialStatus: unpaid.status,
      finalStatus: unpaid.status,
      events,
      error: "expected_402",
    };
  }
  const paymentRequiredAt = now().toISOString();
  event("payment_required", "HTTP 402 received");
  const challenge = paymentRequiredSchema.parse(await unpaid.json());
  const requirements = challenge.accepts.at(0);
  if (!requirements) throw new Error("Payment challenge contains no requirements");
  const registry = RESOURCE_REGISTRY["weather-risk"];
  const idempotencyKey = `${taskId}:weather-risk`;
  event("evaluating_policy", "Applying deterministic spending policy");
  const decision = evaluatePayment({
    requirements,
    expectedPriceTinybars: registry.priceTinybars,
    expectedSeller: options.sellerAccountId,
    allowedResources: new Set(["weather-risk"]),
    maxResourceTinybars: options.maxResourceTinybars,
    maxTaskTinybars: options.maxTaskTinybars,
    maxPeriodTinybars: options.maxPeriodTinybars,
    taskSpentTinybars: options.taskSpentTinybars ?? 0n,
    periodSpentTinybars: options.periodSpentTinybars ?? 0n,
    idempotencyKey,
    usedIdempotencyKeys: options.usedIdempotencyKeys ?? new Set(),
    now: now(),
  });
  if (!decision.approved) {
    event("policy_rejected", decision.reason);
    return { initialStatus: 402, finalStatus: 402, events, error: decision.code };
  }
  event("payment_prepared", "Policy approved; preparing signed Hedera payment");
  const payload = await createPaymentPayload(options.buyer, requirements);
  const facilitatorBody = JSON.stringify({
    paymentPayload: payload,
    paymentRequirements: requirements,
  });
  event("verifying", "Facilitator is validating the signed payment");
  const verify = await fetch(`${options.facilitatorUrl}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: facilitatorBody,
    signal: AbortSignal.timeout(10_000),
  });
  if (!verify.ok) {
    event("failed", "Facilitator rejected payment verification");
    return { initialStatus: 402, finalStatus: 402, events, error: "verification_failed" };
  }
  event("settling", "Facilitator settlement requested");
  const settle = await fetch(`${options.facilitatorUrl}/settle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: facilitatorBody,
    signal: AbortSignal.timeout(35_000),
  });
  const settlement = (await settle.json()) as { state: string; transactionId?: string };
  if (settlement.state === "ambiguous") {
    event("ambiguous", "Settlement confirmation is ambiguous");
    return { initialStatus: 402, finalStatus: 503, events, error: "ambiguous_settlement" };
  }
  if (!settle.ok || settlement.state !== "settled" || !settlement.transactionId) {
    event("failed", "Facilitator settlement failed");
    return { initialStatus: 402, finalStatus: 402, events, error: "settlement_failed" };
  }
  event("settled", "Hedera receipt confirmed settlement");
  event("resource_retrying", "Retrying protected resource with X-PAYMENT proof");
  const paid = await fetch(endpoint, {
    headers: {
      "x-correlation-id": correlationId,
      "x-payment": Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
      "x-agripay-payment-nonce": requirements.nonce,
    },
  });
  if (paid.status !== 200) {
    event("failed", "Payment or delivery failed");
    return { initialStatus: 402, finalStatus: paid.status, events, error: "purchase_failed" };
  }
  const settlementHeader = paid.headers.get("x-payment-response");
  if (!settlementHeader) throw new Error("Missing sanitized settlement response");
  const deliverySettlement = JSON.parse(
    Buffer.from(settlementHeader, "base64").toString("utf8"),
  ) as {
    state: string;
    transactionId: string;
  };
  if (deliverySettlement.state !== "settled" || !deliverySettlement.transactionId) {
    event("ambiguous", "Delivery response lacked definitive settlement evidence");
    return { initialStatus: 402, finalStatus: 200, events, error: "ambiguous_settlement" };
  }
  const data = weatherRiskSchema.parse(await paid.json());
  event("delivered", "Protected weather fixture validated and delivered");
  const amount = BigInt(requirements.maxAmountRequired);
  const isMock = deliverySettlement.transactionId.startsWith("mock-");
  const receipt: PaymentReceipt = {
    taskId,
    resourceId: "weather-risk",
    county: options.county,
    crop: options.crop,
    buyerAccountId: options.buyer.accountId,
    sellerAccountId: options.sellerAccountId,
    facilitatorAccountId: options.facilitatorAccountId,
    network: "hedera-testnet",
    asset: "HBAR",
    amountTinybars: amount.toString(),
    amountHbar: formatHbar(amount),
    paymentRequiredAt,
    policyDecision: "approved",
    settlementState: "settled",
    transactionId: deliverySettlement.transactionId,
    ...(isMock ? {} : { hashscanUrl: hashscanTransactionUrl(deliverySettlement.transactionId) }),
    deliveryState: "delivered",
    correlationId,
  };
  return { initialStatus: 402, finalStatus: 200, events, receipt, data };
}

export async function storeReceipt(
  receipt: PaymentReceipt,
  path = "data/receipts.json",
): Promise<void> {
  await mkdir("data", { recursive: true, mode: 0o700 });
  let receipts: PaymentReceipt[] = [];
  try {
    receipts = JSON.parse(await readFile(path, "utf8")) as PaymentReceipt[];
  } catch {
    // First receipt creates the store.
  }
  receipts.push(receipt);
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(receipts, null, 2), { mode: 0o600, flag: "wx" });
  await rename(temporary, path);
}
