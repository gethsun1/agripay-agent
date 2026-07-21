import {
  FUNDING,
  MAX_PROVISIONING_HBAR,
  loadEnvironmentFile,
  provisionAccounts,
  validateBootstrap,
} from "./provision.js";

const local = await loadEnvironmentFile(".env");
const config = validateBootstrap({ ...process.env, ...local });
const dryRun = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--confirm-testnet-account-creation");

console.log("AgriPay Hedera provisioning preview");
console.log(`Network: ${config.network}`);
console.log(`Bootstrap public account: ${config.accountId}`);
console.log(
  `Roles: buyer (${String(FUNDING.buyer)} HBAR), seller (${String(FUNDING.seller)} HBAR), facilitator (${String(FUNDING.facilitator)} HBAR)`,
);
console.log(`Expected maximum consumption: ${String(MAX_PROVISIONING_HBAR)} test HBAR`);
console.log("Secret output: redacted");

if (dryRun) process.exit(0);
if (!confirmed) {
  throw new Error("Add --confirm-testnet-account-creation after reviewing the sanitized preview");
}
const accounts = await provisionAccounts(config);
for (const account of accounts) {
  console.log(`${account.role}: ${account.accountId}`);
  console.log(`Public key: ${account.publicKey}`);
  console.log(`Initial balance: ${String(account.initialBalanceHbar)} HBAR`);
  console.log(`Account: ${account.accountUrl}`);
  console.log(`Creation transaction: ${account.transactionId}`);
  console.log(`Transaction: ${account.transactionUrl}`);
}
