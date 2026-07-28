import { describe, expect, it } from "vitest";
import { formatTinybars, hashscanUrl, mirrorUrl } from "./data";
import { mergeEvents, terminalStates, type TaskEvent } from "./api";
describe("public presentation utilities", () => {
  it.each([
    ["5000000", "0.05"],
    ["7000000", "0.07"],
    ["16000000", "0.16"],
    ["1", "0.00000001"],
  ])("formats %s tinybars exactly", (input, expected) => {
    expect(formatTinybars(input)).toBe(expected);
  });
  it("creates exact testnet evidence links", () => {
    expect(hashscanUrl("0.0.3@10.20")).toContain("transaction/0.0.3-10-20");
    expect(mirrorUrl("0.0.3@10.20")).toContain("0.0.3-10-20");
  });
  it("sorts and suppresses duplicate timeline events", () => {
    const event = (id: number): TaskEvent => ({
      id,
      task_id: "t",
      resource_id: null,
      state: "planning",
      event_type: "event",
      detail: "safe",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(mergeEvents([event(2)], [event(1), event(2)]).map((x) => x.id)).toEqual([1, 2]);
  });
  it.each(["completed", "partial", "failed", "policy_rejected"])(
    "treats %s as terminal",
    (state) => {
      expect(terminalStates.has(state)).toBe(true);
    },
  );
});
