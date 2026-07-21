import { describe, expect, it } from "vitest";
import { PrivateKey } from "@hashgraph/sdk";
import type { PaymentRequirements } from "@agripay/schemas";
import {
  createPaymentPayload,
  hashscanTransactionUrl,
  redactSecrets,
  verifyPayment,
  recoverSettlement,
} from "./index.js";

const buyerKey = PrivateKey.generateECDSA();
const buyer = { accountId: "0.0.1001", privateKey: buyerKey.toStringDer() };
const requirements = (overrides: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
  scheme: "exact",
  network: "hedera-testnet",
  asset: "HBAR",
  maxAmountRequired: "5000000",
  payTo: "0.0.1002",
  resource: "weather-risk",
  description: "Demonstration weather risk",
  expiresAt: "2030-01-01T00:00:00.000Z",
  nonce: "0123456789abcdef",
  extra: { feePayer: "0.0.1003" },
  ...overrides,
});

describe("mirror recovery", () => {
  it("confirms a successful transaction", async () => {
    expect(
      await recoverSettlement("0.0.3@1.2", () =>
        Promise.resolve(
          new Response(JSON.stringify({ transactions: [{ result: "SUCCESS" }] }), { status: 200 }),
        ),
      ),
    ).toMatchObject({ state: "settled" });
  });
  it("keeps a missing transaction ambiguous", async () => {
    expect(
      await recoverSettlement("0.0.3@1.2", () =>
        Promise.resolve(new Response("", { status: 404 })),
      ),
    ).toMatchObject({ state: "ambiguous" });
  });
  it("marks a definitive mirror failure", async () => {
    expect(
      await recoverSettlement("0.0.3@1.2", () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ transactions: [{ result: "INSUFFICIENT_ACCOUNT_BALANCE" }] }),
            { status: 200 },
          ),
        ),
      ),
    ).toMatchObject({ state: "failed" });
  });
});

describe("Hedera exact payment", () => {
  it("validates payer, recipient, amount, asset, and signature", async () => {
    const payload = await createPaymentPayload(buyer, requirements());
    expect(
      await verifyPayment(
        payload,
        requirements(),
        buyer.accountId,
        buyerKey.publicKey.toStringDer(),
        new Set(),
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ isValid: true });
  });

  it("rejects seller substitution", async () => {
    const payload = await createPaymentPayload(buyer, requirements());
    expect(
      await verifyPayment(
        payload,
        requirements({ payTo: "0.0.9999" }),
        buyer.accountId,
        buyerKey.publicKey.toStringDer(),
        new Set(),
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ isValid: false, reason: "wrong_recipient_or_amount" });
  });

  it("rejects invalid signatures", async () => {
    const otherKey = PrivateKey.generateECDSA();
    const payload = await createPaymentPayload(
      { accountId: buyer.accountId, privateKey: otherKey.toStringDer() },
      requirements(),
    );
    expect(
      await verifyPayment(
        payload,
        requirements(),
        buyer.accountId,
        buyerKey.publicKey.toStringDer(),
        new Set(),
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ isValid: false, reason: "invalid_signature" });
  });

  it("rejects replayed nonces", async () => {
    const payload = await createPaymentPayload(buyer, requirements());
    expect(
      await verifyPayment(
        payload,
        requirements(),
        buyer.accountId,
        buyerKey.publicKey.toStringDer(),
        new Set([requirements().nonce]),
      ),
    ).toMatchObject({ isValid: false, reason: "replay_detected" });
  });

  it("redacts signing and authorization material", () => {
    expect(
      redactSecrets({ privateKey: "sensitive", nested: { authorization: "bearer" }, safe: "ok" }),
    ).toEqual({ privateKey: "[REDACTED]", nested: { authorization: "[REDACTED]" }, safe: "ok" });
  });

  it("creates the documented HashScan testnet transaction route", () => {
    expect(hashscanTransactionUrl("0.0.1003@1784667109.208338088")).toBe(
      "https://hashscan.io/testnet/transaction/1784667109.208338088?tid=0.0.1003-1784667109-208338088",
    );
  });
});
