/*
 * Hedera exact-payment flow adapted from hedera-dev/x402-hedera at
 * d11dc65ab12fbdf644f1b2dba40fdd05f5a9ab1 (Apache-2.0).
 * AgriPay adds strict recipient, amount, payer-signature, expiry, and replay checks.
 */
import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  PublicKey,
  Status,
  Transaction,
  TransactionId,
  TransferTransaction,
} from "@hashgraph/sdk";
import {
  paymentPayloadSchema,
  paymentRequirementsSchema,
  type PaymentPayload,
  type PaymentRequirements,
} from "@agripay/schemas";

export interface HederaCredentials {
  accountId: string;
  privateKey: string;
}

export type VerifyResult =
  | { isValid: true; transaction: TransferTransaction }
  | { isValid: false; reason: string };

export type SettlementResult =
  | { state: "settled"; transactionId: string }
  | { state: "failed"; reason: string }
  | { state: "ambiguous"; reason: string; transactionId?: string };

export function hashscanTransactionUrl(transactionId: string): string {
  const match = /^(0\.0\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
  if (!match) throw new Error("Invalid Hedera transaction ID");
  const accountId = match[1];
  const seconds = match[2];
  const nanos = match[3];
  if (!accountId || !seconds || !nanos) throw new Error("Invalid Hedera transaction ID");
  const timestamp = `${seconds}.${nanos}`;
  const mirrorId = `${accountId}-${seconds}-${nanos}`;
  return `https://hashscan.io/testnet/transaction/${timestamp}?tid=${encodeURIComponent(mirrorId)}`;
}

export function hashscanAccountUrl(accountId: string): string {
  return `https://hashscan.io/testnet/account/${encodeURIComponent(accountId)}`;
}

export function mirrorNodeTransactionUrl(transactionId: string): string {
  const match = /^(0\.0\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
  if (!match) throw new Error("Invalid Hedera transaction ID");
  const [, account, seconds, nanos] = match;
  if (!account || !seconds || !nanos) throw new Error("Invalid Hedera transaction ID");
  return `https://testnet.mirrornode.hedera.com/api/v1/transactions/${account}-${seconds}-${nanos}`;
}

export async function recoverSettlement(
  transactionId: string,
  fetcher: typeof fetch = fetch,
): Promise<SettlementResult> {
  try {
    const response = await fetcher(mirrorNodeTransactionUrl(transactionId), {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404)
      return { state: "ambiguous", reason: "mirror_transaction_not_yet_visible", transactionId };
    if (!response.ok)
      return { state: "ambiguous", reason: "mirror_query_unavailable", transactionId };
    const body = (await response.json()) as { transactions?: { result?: string }[] };
    const result = body.transactions?.[0]?.result;
    if (result === "SUCCESS") return { state: "settled", transactionId };
    if (result) return { state: "failed", reason: "hedera_transaction_failed" };
    return { state: "ambiguous", reason: "mirror_result_unavailable", transactionId };
  } catch {
    return { state: "ambiguous", reason: "mirror_query_unavailable", transactionId };
  }
}

export function createTestnetClient(credentials?: HederaCredentials): Client {
  const client = Client.forTestnet().setDefaultMaxTransactionFee(new Hbar(1));
  if (credentials) {
    client.setOperator(
      AccountId.fromString(credentials.accountId),
      PrivateKey.fromStringECDSA(credentials.privateKey),
    );
  }
  return client;
}

export async function createPaymentPayload(
  buyer: HederaCredentials,
  requirementsInput: PaymentRequirements,
): Promise<PaymentPayload> {
  const requirements = paymentRequirementsSchema.parse(requirementsInput);
  const client = createTestnetClient();
  try {
    const transaction = new TransferTransaction()
      .setTransactionId(TransactionId.generate(requirements.extra.feePayer))
      .setMaxTransactionFee(new Hbar(1))
      .setTransactionValidDuration(120)
      .setTransactionMemo(`AgriPay:${requirements.resource}:${requirements.nonce.slice(0, 16)}`)
      .addHbarTransfer(buyer.accountId, Hbar.fromTinybars(`-${requirements.maxAmountRequired}`))
      .addHbarTransfer(requirements.payTo, Hbar.fromTinybars(requirements.maxAmountRequired))
      .freezeWith(client);
    const signed = await transaction.sign(PrivateKey.fromStringECDSA(buyer.privateKey));
    return {
      x402Version: 1,
      scheme: "exact",
      network: requirements.network,
      payload: { transaction: Buffer.from(signed.toBytes()).toString("base64") },
    };
  } finally {
    client.close();
  }
}

function matchesTransfer(
  transaction: TransferTransaction,
  accountId: string,
  tinybars: bigint,
): boolean {
  return transaction.hbarTransfersList.some(
    (transfer) =>
      transfer.accountId.toString() === accountId &&
      BigInt(transfer.amount.toTinybars().toString()) === tinybars,
  );
}

export async function verifyPayment(
  payloadInput: unknown,
  requirementsInput: unknown,
  buyerAccountId: string,
  buyerPublicKey: string,
  usedNonces: ReadonlySet<string>,
  now = new Date(),
): Promise<VerifyResult> {
  try {
    const payload = paymentPayloadSchema.parse(payloadInput);
    const requirements = paymentRequirementsSchema.parse(requirementsInput);
    if (payload.network !== "hedera-testnet" || requirements.network !== "hedera-testnet") {
      return { isValid: false, reason: "invalid_network" };
    }
    if (requirements.asset.toUpperCase() !== "HBAR") {
      return { isValid: false, reason: "invalid_asset" };
    }
    if (new Date(requirements.expiresAt).getTime() <= now.getTime()) {
      return { isValid: false, reason: "expired_requirements" };
    }
    if (usedNonces.has(requirements.nonce)) return { isValid: false, reason: "replay_detected" };
    const bytes = Buffer.from(payload.payload.transaction, "base64");
    if (bytes.length === 0) return { isValid: false, reason: "malformed_payment" };
    const decoded = Transaction.fromBytes(bytes);
    if (!(decoded instanceof TransferTransaction)) {
      return { isValid: false, reason: "invalid_transaction_type" };
    }
    if (decoded.transactionId?.accountId?.toString() !== requirements.extra.feePayer) {
      return { isValid: false, reason: "wrong_fee_payer" };
    }
    if (decoded.hbarTransfersList.length !== 2) {
      return { isValid: false, reason: "unexpected_transfers" };
    }
    const amount = BigInt(requirements.maxAmountRequired);
    if (!matchesTransfer(decoded, buyerAccountId, -amount)) {
      return { isValid: false, reason: "wrong_payer_or_amount" };
    }
    if (!matchesTransfer(decoded, requirements.payTo, amount)) {
      return { isValid: false, reason: "wrong_recipient_or_amount" };
    }
    const expectedKey = PublicKey.fromString(buyerPublicKey).toStringDer();
    const signatures = await decoded.getSignaturesAsync();
    const hasBuyerSignature = signatures
      .getFlatSignatureList()
      .some((signaturePairs) =>
        [...signaturePairs.keys()].some((key) => key.toStringDer() === expectedKey),
      );
    if (!hasBuyerSignature) return { isValid: false, reason: "invalid_signature" };
    return { isValid: true, transaction: decoded };
  } catch {
    return { isValid: false, reason: "malformed_payment" };
  }
}

export async function settlePayment(
  verified: VerifyResult,
  facilitator: HederaCredentials,
  timeoutMs = 30_000,
): Promise<SettlementResult> {
  if (!verified.isValid) return { state: "failed", reason: verified.reason };
  const client = createTestnetClient(facilitator);
  let transactionId: string | undefined;
  try {
    const signed = await verified.transaction.sign(
      PrivateKey.fromStringECDSA(facilitator.privateKey),
    );
    const response = await signed.execute(client);
    transactionId = response.transactionId.toString();
    const receipt = await Promise.race([
      response.getReceipt(client),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(new Error("settlement_timeout"));
        }, timeoutMs),
      ),
    ]);
    return receipt.status === Status.Success
      ? { state: "settled", transactionId }
      : { state: "failed", reason: "hedera_receipt_failed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("timeout") || transactionId) {
      return {
        state: "ambiguous",
        reason: "settlement_confirmation_ambiguous",
        ...(transactionId ? { transactionId } : {}),
      };
    }
    return { state: "failed", reason: "settlement_failed" };
  } finally {
    client.close();
  }
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /(private.?key|api.?key|authorization|transaction)$/i.test(key)
          ? "[REDACTED]"
          : redactSecrets(item),
      ]),
    );
  }
  return value;
}
