import { randomUUID } from "node:crypto";
import { DurableStore } from "@agripay/storage";
import { createFacilitatorServer } from "./index.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};
if ((process.env.HEDERA_NETWORK ?? "testnet") !== "testnet") throw new Error("mainnet_refused");
const mode = process.env.APP_MODE ?? "mock";
if (mode !== "mock" && mode !== "hedera-testnet") throw new Error("invalid_app_mode");
const store = new DurableStore(required("DATABASE_URL"));
const server = createFacilitatorServer({
  buyerAccountId: required("HEDERA_BUYER_ACCOUNT_ID"),
  buyerPublicKey: required("HEDERA_BUYER_PUBLIC_KEY"),
  expectedSellerAccountId: required("HEDERA_SELLER_ACCOUNT_ID"),
  expectedPriceTinybars: 5_000_000n,
  facilitator: {
    accountId: required("HEDERA_FACILITATOR_ACCOUNT_ID"),
    privateKey: required("HEDERA_FACILITATOR_PRIVATE_KEY"),
  },
  store,
  ...(mode === "mock"
    ? {
        settle: () =>
          Promise.resolve({ state: "settled" as const, transactionId: `mock-${randomUUID()}` }),
      }
    : {}),
});
const port = Number(process.env.PORT ?? "3003");
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`facilitator listening on 127.0.0.1:${String(port)}\n`),
);
const shutdown = (): void => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
