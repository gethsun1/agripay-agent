import { z } from "zod";

export const resourceIdSchema = z.enum(["weather-risk", "disease-risk", "market-intelligence"]);
export type ResourceId = z.infer<typeof resourceIdSchema>;

export const hederaAccountIdSchema = z.string().regex(/^0\.0\.\d+$/, "expected Hedera account ID");

export const paymentRequirementsSchema = z.object({
  scheme: z.literal("exact"),
  network: z.string().min(1),
  asset: z.string().min(1),
  maxAmountRequired: z.string().regex(/^\d+$/),
  payTo: hederaAccountIdSchema,
  resource: resourceIdSchema,
  description: z.string().min(1).max(300),
  expiresAt: z.string().datetime(),
  nonce: z.string().min(16).max(128),
  extra: z.object({ feePayer: hederaAccountIdSchema }),
});
export type PaymentRequirements = z.infer<typeof paymentRequirementsSchema>;

export const paymentRequiredSchema = z.object({
  x402Version: z.literal(1),
  accepts: z.array(paymentRequirementsSchema).min(1),
  error: z.string().optional(),
});

export const paymentPayloadSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal("exact"),
  network: z.string().min(1),
  payload: z.object({ transaction: z.string().min(1) }),
});
export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;

export const weatherRiskSchema = z.object({
  county: z.string().min(1),
  crop: z.string().min(1),
  sevenDaySummary: z.string().min(1),
  rainfallOutlook: z.enum(["low", "moderate", "favourable", "high"]),
  soilMoistureOutlook: z.enum(["low", "adequate", "high"]),
  temperatureRisk: z.enum(["low", "moderate", "high"]),
  plantingRecommendation: z.string().min(1),
  riskFlags: z.array(z.string()),
  provenance: z.literal("curated demonstration fixture"),
  fixtureVersion: z.string().min(1),
  disclaimer: z.string().min(1),
});
export type WeatherRisk = z.infer<typeof weatherRiskSchema>;

export const diseaseRiskSchema = z.object({
  county: z.string().min(1),
  crop: z.string().min(1),
  riskLevel: z.enum(["low", "moderate", "high"]),
  factors: z.array(z.string().min(1)).min(1),
  scoutingActions: z.array(z.string().min(1)).min(1),
  preventionActions: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["low", "moderate", "high"]),
  provenance: z.literal("curated demonstration fixture"),
  fixtureVersion: z.string().min(1),
  disclaimer: z.string().min(1),
});
export type DiseaseRisk = z.infer<typeof diseaseRiskSchema>;

export const marketIntelligenceSchema = z.object({
  county: z.string().min(1),
  commodity: z.string().min(1),
  priceRangeKesPer90Kg: z.object({ min: z.number().int().nonnegative(), max: z.number().int() }),
  demand: z.enum(["weak", "steady", "strong"]),
  supply: z.enum(["tight", "balanced", "ample"]),
  timing: z.string().min(1),
  risks: z.array(z.string().min(1)),
  provenance: z.literal("curated demonstration fixture"),
  fixtureVersion: z.string().min(1),
  disclaimer: z.string().min(1),
});
export type MarketIntelligence = z.infer<typeof marketIntelligenceSchema>;

export const resourcePlanItemSchema = z
  .object({
    resourceId: resourceIdSchema,
    reason: z.string().min(1).max(240),
    priority: z.number().int().min(1).max(3),
  })
  .strict();
export const taskPlanSchema = z
  .object({
    intent: z.string().min(1).max(160),
    location: z.object({ county: z.string().min(1).max(80) }).strict(),
    crop: z.string().min(1).max(80).optional(),
    commodity: z.string().min(1).max(80).optional(),
    requestedOutcome: z.string().min(1).max(240),
    resources: z.array(resourcePlanItemSchema).min(1).max(3),
  })
  .strict();
export type TaskPlan = z.infer<typeof taskPlanSchema>;

export const lifecycleStateSchema = z.enum([
  "created",
  "planning",
  "plan_ready",
  "preflight_policy_check",
  "requesting_resource",
  "payment_required",
  "evaluating_policy",
  "policy_rejected",
  "payment_prepared",
  "verifying",
  "settling",
  "settled",
  "resource_retrying",
  "delivered",
  "partial",
  "synthesizing",
  "completed",
  "failed",
  "ambiguous",
]);
