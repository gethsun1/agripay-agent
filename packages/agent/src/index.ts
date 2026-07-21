import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { RESOURCE_REGISTRY } from "@agripay/fixtures";
import {
  createPaymentPayload,
  hashscanTransactionUrl,
  mirrorNodeTransactionUrl,
  type HederaCredentials,
} from "@agripay/payments";
import { evaluatePayment } from "@agripay/policy";
import {
  paymentRequiredSchema,
  weatherRiskSchema,
  type ResourceId,
  type WeatherRisk,
} from "@agripay/schemas";
import { diseaseRiskSchema, marketIntelligenceSchema } from "@agripay/schemas";
import { DurableStore } from "@agripay/storage";
import { planQuestion, synthesize, type GroqOptions, type PlanningResult } from "@agripay/planner";
import { evaluateTask } from "@agripay/policy";

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
  mirrorNodeUrl?: string;
  deliveryState: "delivered";
  correlationId: string;
  purchaseRationale?: string;
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

export interface TaskOptions extends PurchaseOptions {
  question: string;
  store: DurableStore;
  groq?: GroqOptions;
  submissionKey?: string;
  maxPaymentsPerTask?: number;
  availableBalanceTinybars?: bigint;
  taskId?: string;
  correlationId?: string;
  planningResult?: PlanningResult;
}
export interface TaskResult {
  taskId: string;
  correlationId: string;
  state: "completed" | "partial" | "failed" | "ambiguous";
  planning: PlanningResult;
  estimatedTinybars: string;
  spentTinybars: string;
  resources: {
    resourceId: ResourceId;
    initialStatus: number;
    finalStatus: number;
    receipt?: PaymentReceipt;
    data?: unknown;
    error?: string;
  }[];
  answer?: Record<string, unknown>;
  synthesisSource?: string;
}

const validators = {
  "weather-risk": weatherRiskSchema,
  "disease-risk": diseaseRiskSchema,
  "market-intelligence": marketIntelligenceSchema,
} as const;
function endpointFor(resourceId: ResourceId, options: PurchaseOptions): URL {
  const endpoint = new URL(RESOURCE_REGISTRY[resourceId].path, options.resourceServerUrl);
  endpoint.searchParams.set("county", options.county);
  endpoint.searchParams.set(
    resourceId === "market-intelligence" ? "commodity" : "crop",
    options.crop,
  );
  return endpoint;
}
function record(
  store: DurableStore,
  taskId: string,
  resourceId: ResourceId | null,
  state:
    | LifecycleState
    | "planning"
    | "plan_ready"
    | "preflight_policy_check"
    | "partial"
    | "synthesizing"
    | "completed",
  type: string,
  detail: string,
): void {
  store.event(taskId, resourceId, state, type, detail);
}

async function purchaseResource(
  taskId: string,
  correlationId: string,
  resourceId: ResourceId,
  options: TaskOptions,
  spent: bigint,
  paymentCount: number,
): Promise<{
  resourceId: ResourceId;
  initialStatus: number;
  finalStatus: number;
  receipt?: PaymentReceipt;
  data?: unknown;
  error?: string;
}> {
  const existing = options.store.getPurchase(taskId, resourceId);
  if (existing?.delivery_state === "delivered")
    return {
      resourceId,
      initialStatus: 402,
      finalStatus: 200,
      ...(typeof existing.receipt_json === "string"
        ? { receipt: JSON.parse(existing.receipt_json) as PaymentReceipt }
        : {}),
      ...(typeof existing.data_json === "string"
        ? { data: JSON.parse(existing.data_json) as unknown }
        : {}),
    };
  const endpoint = endpointFor(resourceId, options);
  record(
    options.store,
    taskId,
    resourceId,
    "requesting_resource",
    "resource_requested",
    `Requesting registered ${resourceId}`,
  );
  const unpaid = await fetch(endpoint, {
    headers: { "x-correlation-id": correlationId },
    signal: AbortSignal.timeout(10_000),
  });
  if (unpaid.status !== 402)
    return {
      resourceId,
      initialStatus: unpaid.status,
      finalStatus: unpaid.status,
      error: "expected_402",
    };
  record(
    options.store,
    taskId,
    resourceId,
    "payment_required",
    "http_402_received",
    "HTTP 402 received",
  );
  const requirement = paymentRequiredSchema.parse(await unpaid.json()).accepts[0];
  if (!requirement) throw new Error("missing_requirements");
  const requirementDigest = createHash("sha256").update(JSON.stringify(requirement)).digest("hex");
  options.store.updatePurchase(taskId, resourceId, { requirementDigest, requirement });
  record(
    options.store,
    taskId,
    resourceId,
    "evaluating_policy",
    "resource_policy_evaluating",
    "Evaluating immutable registry requirements",
  );
  const registry = RESOURCE_REGISTRY[resourceId];
  const decision = evaluatePayment({
    requirements: requirement,
    expectedPriceTinybars: registry.priceTinybars,
    expectedSeller: options.sellerAccountId,
    allowedResources: new Set(Object.keys(RESOURCE_REGISTRY) as ResourceId[]),
    maxResourceTinybars: options.maxResourceTinybars,
    maxTaskTinybars: options.maxTaskTinybars,
    maxPeriodTinybars: options.maxPeriodTinybars,
    taskSpentTinybars: spent,
    periodSpentTinybars: options.store.periodSpend(new Date(Date.now() - 86_400_000).toISOString()),
    idempotencyKey: `${taskId}:${resourceId}`,
    usedIdempotencyKeys: new Set(),
    now: new Date(),
    paymentCount,
    maxPaymentsPerTask: options.maxPaymentsPerTask ?? 3,
    ...(options.availableBalanceTinybars === undefined
      ? {}
      : { availableBalanceTinybars: options.availableBalanceTinybars - spent }),
  });
  if (!decision.approved) {
    record(
      options.store,
      taskId,
      resourceId,
      "policy_rejected",
      "resource_policy_rejected",
      decision.reason,
    );
    return { resourceId, initialStatus: 402, finalStatus: 402, error: decision.code };
  }
  record(
    options.store,
    taskId,
    resourceId,
    "payment_prepared",
    "payment_prepared",
    "Policy approved; signed payment prepared",
  );
  const payload = await createPaymentPayload(options.buyer, requirement);
  const paymentDigest = createHash("sha256").update(payload.payload.transaction).digest("hex");
  options.store.updatePurchase(taskId, resourceId, { paymentDigest, settlementState: "prepared" });
  const body = JSON.stringify({ paymentPayload: payload, paymentRequirements: requirement });
  record(
    options.store,
    taskId,
    resourceId,
    "verifying",
    "payment_verifying",
    "Facilitator verification requested",
  );
  const verify = await fetch(`${options.facilitatorUrl}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!verify.ok)
    return { resourceId, initialStatus: 402, finalStatus: 402, error: "verification_failed" };
  record(
    options.store,
    taskId,
    resourceId,
    "settling",
    "payment_submitted",
    "Settlement submitted",
  );
  const settle = await fetch(`${options.facilitatorUrl}/settle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(35_000),
  });
  const settlement = (await settle.json()) as { state: string; transactionId?: string };
  if (settlement.state === "ambiguous") {
    options.store.updatePurchase(taskId, resourceId, {
      settlementState: "ambiguous",
      ...(settlement.transactionId ? { transactionId: settlement.transactionId } : {}),
    });
    record(
      options.store,
      taskId,
      resourceId,
      "ambiguous",
      "settlement_ambiguous",
      "Settlement requires recovery query",
    );
    return { resourceId, initialStatus: 402, finalStatus: 503, error: "ambiguous_settlement" };
  }
  if (!settle.ok || settlement.state !== "settled" || !settlement.transactionId)
    return { resourceId, initialStatus: 402, finalStatus: 402, error: "settlement_failed" };
  options.store.updatePurchase(taskId, resourceId, {
    settlementState: "settled",
    transactionId: settlement.transactionId,
  });
  record(
    options.store,
    taskId,
    resourceId,
    "settled",
    "payment_settled",
    "Hedera settlement confirmed",
  );
  record(
    options.store,
    taskId,
    resourceId,
    "resource_retrying",
    "resource_retry_started",
    "Retrying resource with settlement digest",
  );
  const paid = await fetch(endpoint, {
    headers: {
      "x-correlation-id": correlationId,
      "x-agripay-payment-digest": paymentDigest,
      "x-agripay-payment-nonce": requirement.nonce,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (paid.status !== 200)
    return { resourceId, initialStatus: 402, finalStatus: paid.status, error: "delivery_failed" };
  const data = validators[resourceId].parse(await paid.json());
  const amount = BigInt(requirement.maxAmountRequired);
  const isMock = settlement.transactionId.startsWith("mock-");
  const receipt: PaymentReceipt = {
    taskId,
    resourceId,
    county: options.county,
    crop: options.crop,
    buyerAccountId: options.buyer.accountId,
    sellerAccountId: options.sellerAccountId,
    facilitatorAccountId: options.facilitatorAccountId,
    network: "hedera-testnet",
    asset: "HBAR",
    amountTinybars: amount.toString(),
    amountHbar: formatHbar(amount),
    paymentRequiredAt: new Date().toISOString(),
    policyDecision: "approved",
    settlementState: "settled",
    transactionId: settlement.transactionId,
    ...(isMock
      ? {}
      : {
          hashscanUrl: hashscanTransactionUrl(settlement.transactionId),
          mirrorNodeUrl: mirrorNodeTransactionUrl(settlement.transactionId),
        }),
    deliveryState: "delivered",
    correlationId,
    purchaseRationale: typeof existing?.rationale === "string" ? existing.rationale : "",
  };
  options.store.updatePurchase(taskId, resourceId, { receipt, deliveryState: "delivered", data });
  record(
    options.store,
    taskId,
    resourceId,
    "delivered",
    "resource_validated",
    "HTTP 200 resource validated",
  );
  return { resourceId, initialStatus: 402, finalStatus: 200, receipt, data };
}

export async function runTask(options: TaskOptions): Promise<TaskResult> {
  if (options.question.trim().length < 3 || options.question.length > 1000)
    throw new Error("invalid_question");
  const taskId = options.taskId ?? randomUUID(),
    correlationId = options.correlationId ?? randomUUID();
  options.store.createTask({
    id: taskId,
    correlationId,
    question: options.question,
    ...(options.submissionKey ? { submissionKey: options.submissionKey } : {}),
  });
  record(options.store, taskId, null, "planning", "plan_requested", "Plan requested");
  const planning = options.planningResult ?? (await planQuestion(options.question, options.groq));
  record(
    options.store,
    taskId,
    null,
    "plan_ready",
    planning.planSource === "groq" ? "plan_received" : "fallback_activated",
    planning.fallbackReason ?? "Validated Groq plan received",
  );
  const resources = planning.plan.resources.map((r) => r.resourceId);
  const preflight = evaluateTask({
    resources,
    prices: Object.fromEntries(
      Object.entries(RESOURCE_REGISTRY).map(([id, r]) => [id, r.priceTinybars]),
    ) as Record<ResourceId, bigint>,
    allowedResources: new Set(Object.keys(RESOURCE_REGISTRY) as ResourceId[]),
    maxTaskTinybars: options.maxTaskTinybars,
    maxPaymentsPerTask: options.maxPaymentsPerTask ?? 3,
    periodSpentTinybars: options.store.periodSpend(new Date(Date.now() - 86_400_000).toISOString()),
    maxPeriodTinybars: options.maxPeriodTinybars,
    ...(options.availableBalanceTinybars === undefined
      ? {}
      : { availableBalanceTinybars: options.availableBalanceTinybars }),
  });
  record(
    options.store,
    taskId,
    null,
    "preflight_policy_check",
    preflight.approved ? "preflight_policy_approved" : "preflight_policy_rejected",
    preflight.approved ? "Complete task approved before payment" : preflight.reason,
  );
  if (!preflight.approved) {
    options.store.updateTask(taskId, {
      state: "failed",
      planSource: planning.planSource,
      ...(planning.fallbackReason ? { fallbackReason: planning.fallbackReason } : {}),
      plan: planning.plan,
      errorCode: preflight.code,
    });
    return {
      taskId,
      correlationId,
      state: "failed",
      planning,
      estimatedTinybars: "0",
      spentTinybars: "0",
      resources: [],
    };
  }
  options.store.updateTask(taskId, {
    planSource: planning.planSource,
    ...(planning.fallbackReason ? { fallbackReason: planning.fallbackReason } : {}),
    plan: planning.plan,
    estimatedTinybars: preflight.estimatedTinybars,
  });
  for (const item of planning.plan.resources)
    options.store.addPurchase({
      taskId,
      resourceId: item.resourceId,
      rationale: item.reason,
      priority: item.priority,
      idempotencyKey: `${taskId}:${item.resourceId}`,
      amountTinybars: RESOURCE_REGISTRY[item.resourceId].priceTinybars,
    });
  const results: TaskResult["resources"] = [];
  let spent = 0n;
  for (const item of planning.plan.resources) {
    const result = await purchaseResource(
      taskId,
      correlationId,
      item.resourceId,
      options,
      spent,
      results.filter((r) => r.receipt).length,
    );
    results.push(result);
    if (result.receipt) spent += BigInt(result.receipt.amountTinybars);
    if (result.error === "ambiguous_settlement") {
      options.store.updateTask(taskId, { state: "ambiguous", spentTinybars: spent });
      return {
        taskId,
        correlationId,
        state: "ambiguous",
        planning,
        estimatedTinybars: preflight.estimatedTinybars.toString(),
        spentTinybars: spent.toString(),
        resources: results,
      };
    }
  }
  const delivered = results.filter((r) => r.data).map((r) => r.data);
  if (!delivered.length) {
    options.store.updateTask(taskId, { state: "failed", spentTinybars: spent });
    return {
      taskId,
      correlationId,
      state: "failed",
      planning,
      estimatedTinybars: preflight.estimatedTinybars.toString(),
      spentTinybars: spent.toString(),
      resources: results,
    };
  }
  const partial = delivered.length !== resources.length;
  if (partial)
    record(
      options.store,
      taskId,
      null,
      "partial",
      "task_partial",
      "Some planned resources were unavailable",
    );
  record(
    options.store,
    taskId,
    null,
    "synthesizing",
    "synthesis_started",
    "Synthesizing validated delivered resources only",
  );
  const synthesis = await synthesize(options.question, delivered, options.groq);
  const state = partial ? "partial" : "completed";
  options.store.updateTask(taskId, { state, answer: synthesis.answer, spentTinybars: spent });
  if (!partial)
    record(options.store, taskId, null, "completed", "task_completed", "Task completed");
  return {
    taskId,
    correlationId,
    state,
    planning,
    estimatedTinybars: preflight.estimatedTinybars.toString(),
    spentTinybars: spent.toString(),
    resources: results,
    answer: synthesis.answer,
    synthesisSource: synthesis.source,
  };
}
