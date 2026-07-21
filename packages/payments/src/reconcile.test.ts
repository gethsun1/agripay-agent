import { describe, expect, it } from "vitest";
import { reconcileTransaction } from "./reconcile.js";

const input = {
  transactionId: "0.0.1@1.2",
  payer: "0.0.1",
  recipient: "0.0.2",
  amountTinybars: 5n,
};
const response =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
describe("non-spending reconciliation", () => {
  it("requires exact successful transfers", async () => {
    const result = await reconcileTransaction(
      input,
      response({
        transactions: [
          {
            result: "SUCCESS",
            transfers: [
              { account: "0.0.1", amount: -5 },
              { account: "0.0.2", amount: 5 },
            ],
          },
        ],
      }) as typeof fetch,
    );
    expect(result.state).toBe("settled");
  });
  it("rejects wrong recipient or amount", async () => {
    const result = await reconcileTransaction(
      input,
      response({
        transactions: [
          {
            result: "SUCCESS",
            transfers: [
              { account: "0.0.1", amount: -5 },
              { account: "0.0.3", amount: 5 },
            ],
          },
        ],
      }) as typeof fetch,
    );
    expect(result).toMatchObject({ state: "failed", reason: "wrong_recipient_or_amount" });
  });
  it("keeps missing and unavailable transactions ambiguous", async () => {
    expect(await reconcileTransaction(input, response({}, 404) as typeof fetch)).toMatchObject({
      state: "ambiguous",
    });
    expect(
      await reconcileTransaction(input, (() =>
        Promise.reject(new Error("timeout"))) as typeof fetch),
    ).toMatchObject({ state: "ambiguous" });
  });
});
