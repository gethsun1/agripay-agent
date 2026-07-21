import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DurableStore } from "./index.js";
const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "agripay-store-"));
  dirs.push(d);
  return join(d, "db.sqlite");
};
afterEach(() => {
  dirs.splice(0).forEach((d) => {
    rmSync(d, { recursive: true, force: true });
  });
});
describe("durable storage", () => {
  it("runs idempotent migrations", () => {
    const s = new DurableStore(temp());
    s.migrate();
    expect(s.db.prepare("select count(*) count from schema_migrations").get()).toMatchObject({
      count: 2,
    });
    s.close();
  });
  it("survives restart", () => {
    const p = temp();
    let s = new DurableStore(p);
    s.createTask({ id: "t", correlationId: "c", question: "q" });
    s.close();
    s = new DurableStore(p);
    expect(s.getTask("t")).toMatchObject({ state: "created" });
    s.close();
  });
  it("rejects duplicate task/resource and idempotency keys", () => {
    const s = new DurableStore(temp());
    s.createTask({ id: "t", correlationId: "c", question: "q" });
    s.addPurchase({
      taskId: "t",
      resourceId: "weather-risk",
      rationale: "x",
      priority: 1,
      idempotencyKey: "i",
      amountTinybars: 1n,
    });
    expect(() => {
      s.addPurchase({
        taskId: "t",
        resourceId: "disease-risk",
        rationale: "x",
        priority: 2,
        idempotencyKey: "i",
        amountTinybars: 1n,
      });
    }).toThrow();
    s.close();
  });
  it("rejects duplicate transaction IDs", () => {
    const s = new DurableStore(temp());
    s.createTask({ id: "t", correlationId: "c", question: "q" });
    for (const [id, key] of [
      ["weather-risk", "i1"],
      ["disease-risk", "i2"],
    ] as const)
      s.addPurchase({
        taskId: "t",
        resourceId: id,
        rationale: "x",
        priority: 1,
        idempotencyKey: key,
        amountTinybars: 1n,
      });
    s.updatePurchase("t", "weather-risk", { transactionId: "tx" });
    expect(() => {
      s.updatePurchase("t", "disease-risk", { transactionId: "tx" });
    }).toThrow();
    s.close();
  });
  it("serializes concurrent settlement claims", () => {
    const s = new DurableStore(temp());
    expect(s.claimSettlement({ nonce: "n", requirementDigest: "r", paymentDigest: "p" })).toBe(
      "claimed",
    );
    expect(s.claimSettlement({ nonce: "n", requirementDigest: "r", paymentDigest: "p" })).toBe(
      "existing",
    );
    s.close();
  });
  it("persists ambiguous settlement for recovery", () => {
    const p = temp();
    let s = new DurableStore(p);
    s.claimSettlement({ nonce: "n", requirementDigest: "r", paymentDigest: "p" });
    s.finishSettlement("n", { state: "ambiguous", transactionId: "tx" });
    s.close();
    s = new DurableStore(p);
    expect(s.getSettlement("n")).toMatchObject({ state: "ambiguous", transaction_id: "tx" });
    s.close();
  });
  it("creates a restorable SQLite backup", async () => {
    const p = temp(),
      b = `${p}.bak`;
    let s = new DurableStore(p);
    s.createTask({ id: "t", correlationId: "c", question: "q" });
    await s.backupTo(b);
    s.close();
    expect(readFileSync(b).subarray(0, 6).toString()).toBe("SQLite");
    s = new DurableStore(b);
    expect(s.getTask("t")).toBeTruthy();
    s.close();
  });
});
