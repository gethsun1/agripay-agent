import { z } from "zod";

const integerString = z.string().regex(/^\d+$/).transform(BigInt);
const accountId = z.string().regex(/^0\.0\.\d+$/);

const commonSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_MODE: z.enum(["mock", "hedera-testnet"]).default("mock"),
  HEDERA_NETWORK: z.literal("testnet").default("testnet"),
  HEDERA_SELLER_ACCOUNT_ID: accountId,
  MAX_TASK_SPEND_TINYBARS: integerString,
  MAX_RESOURCE_SPEND_TINYBARS: integerString,
  MAX_PERIOD_SPEND_TINYBARS: integerString,
});

const liveSchema = commonSchema.extend({
  APP_MODE: z.literal("hedera-testnet"),
  HEDERA_BUYER_ACCOUNT_ID: accountId,
  HEDERA_BUYER_PRIVATE_KEY: z.string().min(32),
  HEDERA_FACILITATOR_ACCOUNT_ID: accountId,
  HEDERA_FACILITATOR_PRIVATE_KEY: z.string().min(32),
  X402_FACILITATOR_URL: z.string().url(),
});

export type AppConfig = z.infer<typeof commonSchema>;

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const mode = env.APP_MODE ?? "mock";
  const result = (mode === "hedera-testnet" ? liveSchema : commonSchema).safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid configuration fields: ${fields}`);
  }
  return result.data;
}
