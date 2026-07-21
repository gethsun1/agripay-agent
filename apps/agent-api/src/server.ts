import { PrivateKey } from "@hashgraph/sdk";
import { OperatorAuth } from "@agripay/security";
import { DurableStore } from "@agripay/storage";
import { createAgentApiServer } from "./index.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};
if ((process.env.HEDERA_NETWORK ?? "testnet") !== "testnet") throw new Error("mainnet_refused");
const mode = process.env.APP_MODE ?? "mock";
if (mode !== "mock" && mode !== "hedera-testnet") throw new Error("invalid_app_mode");
const livePaymentsEnabled = process.env.LIVE_PAYMENTS_ENABLED === "true";
if (livePaymentsEnabled && mode !== "hedera-testnet") throw new Error("live_mode_mismatch");
const buyerPrivateKey = required("HEDERA_BUYER_PRIVATE_KEY");
PrivateKey.fromStringECDSA(buyerPrivateKey);
const store = new DurableStore(required("DATABASE_URL"));
if (store.integrityCheck() !== "ok") throw new Error("database_integrity_failed");
const sessionTtl = Number(process.env.SESSION_TTL_SECONDS ?? "900");
const auth = new OperatorAuth(store, {
  secret: required("SESSION_SECRET"),
  passwordHash: required("OPERATOR_PASSWORD_HASH"),
  idleTtlSeconds: sessionTtl,
  absoluteTtlSeconds: Math.max(sessionTtl, 3600),
  secureCookies: process.env.NODE_ENV === "production",
  sameSite: process.env.CROSS_SITE_OPERATOR_COOKIE === "true" ? "None" : "Strict",
});
const server = createAgentApiServer({
  store,
  mode,
  auth,
  livePaymentsEnabled,
  production: process.env.NODE_ENV === "production",
  https: process.env.PUBLIC_API_URL?.startsWith("https://") ?? false,
  allowedOrigins: required("ALLOWED_ORIGINS")
    .split(",")
    .map((item) => item.trim()),
  resourceServerUrl: required("RESOURCE_SERVER_URL"),
  facilitatorUrl: required("X402_FACILITATOR_URL"),
  county: "Nandi",
  crop: "maize",
  buyer: { accountId: required("HEDERA_BUYER_ACCOUNT_ID"), privateKey: buyerPrivateKey },
  sellerAccountId: required("HEDERA_SELLER_ACCOUNT_ID"),
  facilitatorAccountId: required("HEDERA_FACILITATOR_ACCOUNT_ID"),
  maxResourceTinybars: BigInt(process.env.MAX_RESOURCE_SPEND_TINYBARS ?? "10000000"),
  maxTaskTinybars: BigInt(process.env.MAX_TASK_SPEND_TINYBARS ?? "16000000"),
  maxPeriodTinybars: BigInt(process.env.MAX_LIVE_SPEND_TINYBARS_PER_PERIOD ?? "16000000"),
  maxPaymentsPerTask: 3,
  maxLiveTasksPerPeriod: Number(process.env.MAX_LIVE_TASKS_PER_PERIOD ?? "1"),
  maxConcurrentLiveTasks: Number(process.env.MAX_CONCURRENT_LIVE_TASKS ?? "1"),
  maxAmbiguousTasks: Number(process.env.MAX_AMBIGUOUS_TASKS ?? "1"),
  groq: {
    ...(process.env.GROQ_API_KEY ? { apiKey: process.env.GROQ_API_KEY } : {}),
    ...(process.env.GROQ_MODEL ? { model: process.env.GROQ_MODEL } : {}),
  },
});
const port = Number(process.env.PORT ?? "3001");
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`agent API listening on 127.0.0.1:${String(port)}\n`),
);
const shutdown = (): void => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
