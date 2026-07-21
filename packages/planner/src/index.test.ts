import { describe, expect, it, vi } from "vitest";
import { deterministicPlan, normalizePlan, planQuestion } from "./index.js";
const valid = {
  intent: "decide",
  location: { county: " nandi " },
  crop: "Maize",
  commodity: "MAIZE",
  requestedOutcome: "Choose actions",
  resources: [
    { resourceId: "weather-risk", reason: "rain", priority: 2 },
    { resourceId: "weather-risk", reason: "duplicate", priority: 3 },
    { resourceId: "disease-risk", reason: "scout", priority: 1 },
  ],
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
describe("Groq planner boundary", () => {
  it("accepts strict structured output and normalizes/deduplicates", () => {
    expect(normalizePlan(valid)).toMatchObject({
      location: { county: "Nandi" },
      crop: "maize",
      resources: [{ resourceId: "disease-risk" }, { resourceId: "weather-risk" }],
    });
  });
  it.each([
    ["https://evil.example"],
    ["seller 0.0.123"],
    ["pay 10 HBAR"],
    ["authorization bearer"],
  ])("rejects authority-bearing output %s", (value) => {
    expect(() => normalizePlan({ ...valid, intent: value })).toThrow();
  });
  it("rejects unknown resources", () => {
    expect(() =>
      normalizePlan({ ...valid, resources: [{ resourceId: "unknown", reason: "x", priority: 1 }] }),
    ).toThrow();
  });
  it("rejects malformed/schema-invalid output", () => {
    expect(() => normalizePlan({ intent: "x" })).toThrow();
  });
  it("uses a successful Groq plan", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(response({ choices: [{ message: { content: JSON.stringify(valid) } }] })),
    );
    expect(
      await planQuestion("rain and disease", { apiKey: "secret", model: "model", fetch }),
    ).toMatchObject({ planSource: "groq", model: "model" });
  });
  it.each([
    [429, "groq_rate_limited"],
    [401, "authentication_error"],
    [404, "model_unavailable"],
  ] as const)("sanitizes HTTP %s fallback", async (status, reason) => {
    expect(
      await planQuestion("rain", {
        apiKey: "never-print",
        model: "m",
        fetch: () => Promise.resolve(response({}, status)),
      }),
    ).toMatchObject({ planSource: "deterministic-fallback", fallbackReason: reason });
  });
  it("falls back on malformed JSON", async () => {
    expect(
      await planQuestion("rain", {
        apiKey: "x",
        model: "m",
        fetch: () => Promise.resolve(response({ choices: [{ message: { content: "{" } }] })),
      }),
    ).toMatchObject({ fallbackReason: "invalid_structured_output" });
  });
  it("falls back on timeout", async () => {
    expect(
      await planQuestion("rain", {
        apiKey: "x",
        model: "m",
        fetch: () => Promise.reject(new DOMException("timed out", "TimeoutError")),
      }),
    ).toMatchObject({ fallbackReason: "groq_timeout" });
  });
  it("never records a key or raw response in fallback reason", async () => {
    const result = await planQuestion("rain", {
      apiKey: "super-secret",
      model: "m",
      fetch: () => Promise.resolve(response({ privateKey: "bad" }, 500)),
    });
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(result.fallbackReason).toBe("invalid_structured_output");
  });
});
describe("deterministic fallback", () => {
  it.each([
    ["Will it rain before planting?", ["weather-risk"]],
    ["What disease should I scout?", ["disease-risk"]],
    ["What price and demand?", ["market-intelligence"]],
    [
      "Use rain, disease and market price to advise planting and selling",
      ["weather-risk", "disease-risk", "market-intelligence"],
    ],
  ])("maps %s", (question, ids) => {
    expect(deterministicPlan(question).resources.map((x) => x.resourceId)).toEqual(ids);
  });
  it("has a predictable unsupported-query default", () => {
    expect(deterministicPlan("Help me decide").resources[0]?.resourceId).toBe("weather-risk");
  });
});
