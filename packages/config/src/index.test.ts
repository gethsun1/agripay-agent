import { describe, expect, it } from "vitest";
import { parseConfig } from "./index.js";

const mockEnvironment = {
  APP_MODE: "mock",
  HEDERA_NETWORK: "testnet",
  HEDERA_SELLER_ACCOUNT_ID: "0.0.1002",
  MAX_TASK_SPEND_TINYBARS: "30000000",
  MAX_RESOURCE_SPEND_TINYBARS: "10000000",
  MAX_PERIOD_SPEND_TINYBARS: "100000000",
};

describe("parseConfig", () => {
  it("parses monetary limits as integer bigint values", () => {
    expect(parseConfig(mockEnvironment)).toMatchObject({
      APP_MODE: "mock",
      MAX_TASK_SPEND_TINYBARS: 30_000_000n,
    });
  });

  it("refuses live mode when credentials are incomplete without exposing values", () => {
    expect(() => parseConfig({ ...mockEnvironment, APP_MODE: "hedera-testnet" })).toThrow(
      /^Invalid configuration fields:/,
    );
  });

  it("refuses mainnet configuration", () => {
    expect(() => parseConfig({ ...mockEnvironment, HEDERA_NETWORK: "mainnet" })).toThrow(
      /HEDERA_NETWORK/,
    );
  });
});
