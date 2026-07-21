const required = [
  "HEDERA_BUYER_ACCOUNT_ID",
  "HEDERA_BUYER_PRIVATE_KEY",
  "HEDERA_SELLER_ACCOUNT_ID",
  "HEDERA_FACILITATOR_ACCOUNT_ID",
  "HEDERA_FACILITATOR_PRIVATE_KEY",
];
if (process.env.HEDERA_NETWORK !== "testnet" || process.env.APP_MODE !== "hedera-testnet") {
  throw new Error("Live tests require APP_MODE=hedera-testnet and HEDERA_NETWORK=testnet");
}
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required testnet fields: ${missing.join(", ")}`);
