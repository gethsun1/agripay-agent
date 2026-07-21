import { DurableStore } from "@agripay/storage";
import { createResourceServer } from "./index.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};
if ((process.env.HEDERA_NETWORK ?? "testnet") !== "testnet") throw new Error("mainnet_refused");
const store = new DurableStore(required("DATABASE_URL"));
const server = createResourceServer({
  sellerAccountId: required("HEDERA_SELLER_ACCOUNT_ID"),
  facilitatorAccountId: required("HEDERA_FACILITATOR_ACCOUNT_ID"),
  facilitatorUrl: required("X402_FACILITATOR_URL"),
  store,
});
const port = Number(process.env.PORT ?? "3002");
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`resource server listening on 127.0.0.1:${String(port)}\n`),
);
const shutdown = (): void => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
