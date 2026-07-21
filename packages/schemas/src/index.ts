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

export const lifecycleStateSchema = z.enum([
  "created",
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
  "failed",
  "ambiguous",
]);
