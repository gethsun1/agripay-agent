// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Agent } from "../pages/Agent";
import { Developer } from "../pages/Developer";
import { Landing } from "../pages/Landing";
import { Receipts } from "../pages/Receipts";
const view = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
describe("accessible frontend", () => {
  it("renders landing value, catalogue and mode-safe CTA", () => {
    view(<Landing />);
    expect(screen.getByRole("heading", { name: /autonomous intelligence/i })).toBeInTheDocument();
    expect(screen.getByText("0.07")).toBeInTheDocument();
    expect(screen.getByText(/verified testnet evidence/i)).toBeInTheDocument();
  });
  it("applies example prompts and requires explicit live confirmation", () => {
    view(<Agent />);
    fireEvent.click(screen.getByRole("button", { name: /hedera testnet/i }));
    const submit = screen.getByRole("button", { name: /confirm & run/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByLabelText(/what decision/i)).toHaveValue(
      "What disease risks should I watch for in maize?",
    );
  });
  it("guards rapid double submission", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ taskId: "t", correlationId: "c", state: "created" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    view(<Agent />);
    const button = screen.getByRole("button", { name: /run demonstration/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
  it("renders real receipt labels and public links", () => {
    view(<Receipts />);
    expect(screen.getAllByText("Verified testnet evidence").length).toBeGreaterThan(0);
    const inspect = screen.getAllByRole("button", { name: "Inspect" }).at(0);
    if (!inspect) throw new Error("Missing receipt inspect control");
    fireEvent.click(inspect);
    expect(screen.getByRole("dialog")).toHaveTextContent("Real Hedera testnet receipt");
    expect(screen.getByRole("link", { name: /open hashscan/i })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
  it("shows redaction and copy-safe developer view", () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    view(<Developer />);
    expect(screen.getByText("Redaction boundary")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Sanitized JSON" }));
    const redacted = screen.getByText(/REDACTED — signed bytes/);
    expect(redacted).toBeInTheDocument();
    expect(redacted.textContent).not.toContain("privateKey");
  });
});
