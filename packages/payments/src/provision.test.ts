import { describe, expect, it } from "vitest";
import { assertProvisioningAllowed, validateBootstrap } from "./provision.js";

describe("Hedera provisioning safety", () => {
  it("refuses mainnet", () => {
    expect(() =>
      validateBootstrap({
        HEDERA_NETWORK: "mainnet",
        HEDERA_BOOTSTRAP_ACCOUNT_ID: "0.0.1",
        HEDERA_BOOTSTRAP_PRIVATE_KEY: "not-printed",
      }),
    ).toThrow(/non-testnet/);
  });

  it("validates required bootstrap configuration without returning the key in errors", () => {
    expect(() => validateBootstrap({ HEDERA_NETWORK: "testnet" })).toThrow(
      /HEDERA_BOOTSTRAP_ACCOUNT_ID/,
    );
  });

  it("protects against reruns", () => {
    expect(() => {
      assertProvisioningAllowed(true);
    }).toThrow(/already exists/);
    expect(() => {
      assertProvisioningAllowed(false);
    }).not.toThrow();
  });
});
