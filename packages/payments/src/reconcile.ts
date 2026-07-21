import { mirrorNodeTransactionUrl } from "./index.js";

export type ReconciliationResult =
  | { state: "settled"; transactionId: string }
  | { state: "failed"; reason: string }
  | { state: "ambiguous"; reason: string };

export async function reconcileTransaction(
  input: { transactionId: string; payer: string; recipient: string; amountTinybars: bigint },
  fetcher: typeof fetch = fetch,
): Promise<ReconciliationResult> {
  try {
    const response = await fetcher(mirrorNodeTransactionUrl(input.transactionId), {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return { state: "ambiguous", reason: "not_found" };
    if (!response.ok) return { state: "ambiguous", reason: "mirror_unavailable" };
    const body = (await response.json()) as {
      transactions?: { result?: string; transfers?: { account: string; amount: number }[] }[];
    };
    const transaction = body.transactions?.[0];
    if (!transaction?.result) return { state: "ambiguous", reason: "incomplete_result" };
    if (transaction.result !== "SUCCESS") return { state: "failed", reason: "transaction_failed" };
    const transfers = transaction.transfers ?? [];
    const payer = transfers.find((item) => item.account === input.payer);
    const recipient = transfers.find((item) => item.account === input.recipient);
    if (BigInt(payer?.amount ?? 0) !== -input.amountTinybars)
      return { state: "failed", reason: "wrong_payer_or_amount" };
    if (BigInt(recipient?.amount ?? 0) !== input.amountTinybars)
      return { state: "failed", reason: "wrong_recipient_or_amount" };
    return { state: "settled", transactionId: input.transactionId };
  } catch {
    return { state: "ambiguous", reason: "mirror_unavailable" };
  }
}
