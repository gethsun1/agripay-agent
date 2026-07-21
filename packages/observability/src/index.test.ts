import { describe, expect, it, vi } from "vitest";
import { Logger, questionFingerprint, redact } from "./index.js";

describe("redacted observability", () => {
  it("recursively removes secrets while retaining useful context", () => {
    expect(
      redact({ authorization: "Bearer token", nested: { privateKey: "secret", ok: 2 } }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: { privateKey: "[REDACTED]", ok: 2 },
    });
  });
  it("fingerprints questions without retaining their content", () => {
    const result = questionFingerprint("private farm question");
    expect(result).toMatchObject({ length: 21 });
    expect(JSON.stringify(result)).not.toContain("private farm");
  });
  it("emits parseable production JSON with redaction", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    new Logger("test", "production", true).log({ level: "info", event: "sample", password: "x" });
    const row = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(row).toMatchObject({ service: "test", event: "sample", password: "[REDACTED]" });
    write.mockRestore();
  });
});
