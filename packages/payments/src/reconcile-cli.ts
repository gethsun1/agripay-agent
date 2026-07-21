import { DurableStore } from "@agripay/storage";
import { reconcileTransaction } from "./reconcile.js";

if (process.env.HEDERA_NETWORK !== "testnet") throw new Error("Reconciliation is testnet-only");
const payer = process.env.HEDERA_BUYER_ACCOUNT_ID;
const recipient = process.env.HEDERA_SELLER_ACCOUNT_ID;
if (!payer || !recipient) throw new Error("Buyer and seller account IDs are required");
const store = new DurableStore();
try {
  for (const row of store.listRecoverablePurchases()) {
    const transactionId = String(row.transaction_id);
    const result = await reconcileTransaction({
      transactionId,
      payer,
      recipient,
      amountTinybars: BigInt(String(row.amount_tinybars)),
    });
    if (result.state === "settled")
      store.updatePurchase(String(row.task_id), String(row.resource_id), {
        settlementState: "settled",
      });
    process.stdout.write(
      `${JSON.stringify({ taskId: row.task_id, resourceId: row.resource_id, transactionId, ...result })}\n`,
    );
  }
} finally {
  store.close();
}
