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
  return { approved: true, amountTinybars: amount, idempotencyKey: context.idempotencyKey };
}
