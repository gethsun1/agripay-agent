import { z } from "zod";

export const resourceIdSchema = z.enum(["weather-risk", "disease-risk", "market-intelligence"]);
export type ResourceId = z.infer<typeof resourceIdSchema>;

export const hederaAccountIdSchema = z.string().regex(/^0\.0\.\d+$/, "expected Hedera account ID");

export const paymentRequirementsSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal("exact"),
  network: z.string().min(1),
  asset: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  payTo: hederaAccountIdSchema,
  resource: resourceIdSchema,
  expiresAt: z.string().datetime(),
  nonce: z.string().min(16).max(128),
});
export type PaymentRequirements = z.infer<typeof paymentRequirementsSchema>;
