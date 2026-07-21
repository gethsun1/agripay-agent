import type { PaymentRequirements, ResourceId } from "@agripay/schemas";

export interface PolicyContext {
  requirements: PaymentRequirements;
  expectedPriceTinybars: bigint;
  expectedSeller: string;
  allowedResources: ReadonlySet<ResourceId>;
  maxResourceTinybars: bigint;
  maxTaskTinybars: bigint;
  maxPeriodTinybars: bigint;
  taskSpentTinybars: bigint;
  periodSpentTinybars: bigint;
  idempotencyKey: string;
  usedIdempotencyKeys: ReadonlySet<string>;
  now: Date;
  paymentCount?: number;
  maxPaymentsPerTask?: number;
  availableBalanceTinybars?: bigint;
}

export type PolicyDecision =
  | { approved: true; amountTinybars: bigint; idempotencyKey: string }
  | { approved: false; code: string; reason: string };

const reject = (code: string, reason: string): PolicyDecision => ({
  approved: false,
  code,
  reason,
});

export function evaluatePayment(context: PolicyContext): PolicyDecision {
  const requirement = context.requirements;
  if (!context.allowedResources.has(requirement.resource))
    return reject("RESOURCE_DENIED", "Resource is not approved");
  if (requirement.network !== "hedera-testnet")
    return reject("NETWORK_DENIED", "Only Hedera testnet is allowed");
  if (requirement.asset !== "HBAR") return reject("ASSET_DENIED", "Asset is not approved");
  if (requirement.payTo !== context.expectedSeller)
    return reject("SELLER_DENIED", "Seller is not approved");
  const amount = BigInt(requirement.maxAmountRequired);
  if (amount !== context.expectedPriceTinybars)
    return reject("PRICE_CHANGED", "Price differs from the registry");
  if (new Date(requirement.expiresAt).getTime() <= context.now.getTime())
    return reject("EXPIRED", "Payment requirement expired");
  if (amount > context.maxResourceTinybars)
    return reject("RESOURCE_BUDGET", "Resource exceeds its spending limit");
  if (context.taskSpentTinybars + amount > context.maxTaskTinybars)
    return reject("TASK_BUDGET", "Resource exceeds the task budget");
  if (context.periodSpentTinybars + amount > context.maxPeriodTinybars)
    return reject("PERIOD_BUDGET", "Period spending limit reached");
  if (context.usedIdempotencyKeys.has(context.idempotencyKey))
    return reject("DUPLICATE", "Duplicate payment refused");
  if ((context.paymentCount ?? 0) >= (context.maxPaymentsPerTask ?? 3))
    return reject("PAYMENT_COUNT", "Task payment count limit reached");
  if (context.availableBalanceTinybars !== undefined && amount > context.availableBalanceTinybars)
    return reject("INSUFFICIENT_BALANCE", "Buyer balance is insufficient");
  return { approved: true, amountTinybars: amount, idempotencyKey: context.idempotencyKey };
}

export type TaskPolicyDecision =
  | { approved: true; estimatedTinybars: bigint }
  | { approved: false; code: string; reason: string };
const rejectTask = (code: string, reason: string): TaskPolicyDecision => ({
  approved: false,
  code,
  reason,
});
export function evaluateTask(input: {
  resources: readonly ResourceId[];
  prices: Readonly<Record<ResourceId, bigint>>;
  allowedResources: ReadonlySet<ResourceId>;
  maxTaskTinybars: bigint;
  maxPaymentsPerTask: number;
  periodSpentTinybars: bigint;
  maxPeriodTinybars: bigint;
  availableBalanceTinybars?: bigint;
}): TaskPolicyDecision {
  if (input.resources.length > input.maxPaymentsPerTask)
    return rejectTask("PAYMENT_COUNT", "Task requests too many payments");
  if (input.resources.some((id) => !input.allowedResources.has(id)))
    return rejectTask("RESOURCE_DENIED", "Task contains an unapproved resource");
  const total = input.resources.reduce((sum, id) => sum + input.prices[id], 0n);
  if (total > input.maxTaskTinybars)
    return rejectTask("TASK_BUDGET", "Planned task exceeds its budget");
  if (input.periodSpentTinybars + total > input.maxPeriodTinybars)
    return rejectTask("PERIOD_BUDGET", "Planned task exceeds the period budget");
  if (input.availableBalanceTinybars !== undefined && total > input.availableBalanceTinybars)
    return rejectTask("INSUFFICIENT_BALANCE", "Buyer balance is insufficient");
  return { approved: true, estimatedTinybars: total };
}
