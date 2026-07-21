import { useMemo, useState } from "react";
import { StatusBadge } from "../components/Layout";
import { evidence, hashscanUrl, mirrorUrl } from "../lib/data";
const lifecycle = [
  {
    status: "GET",
    title: "Initial resource request",
    detail: "Registered resource path with sanitized county/crop query.",
  },
  {
    status: "402",
    title: "Payment requirements",
    detail: "Exact HBAR amount, testnet, registered seller, expiry and nonce digest.",
  },
  {
    status: "PASS",
    title: "Policy evaluation",
    detail: "Registry price, seller, asset, network, task and period limits matched.",
  },
  {
    status: "SIGN",
    title: "Payment preparation",
    detail: "Buyer signature created server-side. Raw transaction bytes redacted.",
  },
  {
    status: "200",
    title: "Facilitator verification",
    detail: "Payer signature and exact two-party transfer validated.",
  },
  {
    status: "HBAR",
    title: "Hedera settlement",
    detail: "Independent transaction submitted and receipt confirmed.",
  },
  { status: "MIRROR", title: "Mirror confirmation", detail: "Public consensus result is SUCCESS." },
  {
    status: "RETRY",
    title: "Resource retry",
    detail: "Settlement digest and challenge nonce correlated.",
  },
  {
    status: "200",
    title: "Delivery validation",
    detail: "Structured fixture response passed its resource schema.",
  },
];
export function Developer() {
  const [selected, setSelected] = useState<(typeof evidence)[number]>(evidence[0]);
  const [view, setView] = useState<"human" | "json">("human");
  const safeJson = useMemo(
    () =>
      JSON.stringify(
        {
          x402Version: 1,
          resource: selected.resourceId,
          network: "hedera-testnet",
          asset: "HBAR",
          maxAmountRequired: selected.amountTinybars,
          payTo: selected.seller,
          payment: { transaction: "[REDACTED — signed bytes are never exposed]" },
          settlement: { state: selected.settlementState, transactionId: selected.transactionId },
          delivery: { state: selected.deliveryState, httpStatus: 200 },
        },
        null,
        2,
      ),
    [selected],
  );
  return (
    <div className="inner-page">
      <header className="page-hero compact">
        <StatusBadge tone="safe">Sanitized inspection</StatusBadge>
        <p className="kicker">Developer mode</p>
        <h1>Understand x402 in under a minute.</h1>
        <p>
          Select a committed resource and inspect its safe request, authorization, settlement, and
          delivery lifecycle.
        </p>
      </header>
      <section className="inspector">
        <aside>
          <label>
            Transaction
            <select
              value={selected.transactionId}
              onChange={(e) => {
                setSelected(
                  evidence.find((x) => x.transactionId === e.target.value) ?? evidence[0],
                );
              }}
            >
              {evidence.map((item) => (
                <option key={item.transactionId} value={item.transactionId}>
                  {item.phase} · {item.resource}
                </option>
              ))}
            </select>
          </label>
          <div className="inspect-meta">
            <span>
              RESOURCE<b>{selected.resourceId}</b>
            </span>
            <span>
              HTTP FLOW<b>402 → 200</b>
            </span>
            <span>
              NETWORK<b>Hedera testnet</b>
            </span>
            <span>
              AMOUNT<b>{selected.amountHbar} HBAR</b>
            </span>
          </div>
          <div className="redaction-note">
            <b>Redaction boundary</b>
            <p>
              No keys, authorization headers, database credentials, raw signed bytes, provider
              response, stack trace, or model reasoning can appear here.
            </p>
          </div>
        </aside>
        <div className="inspect-main">
          <div className="tabs" role="tablist">
            <button
              className={view === "human" ? "active" : ""}
              onClick={() => {
                setView("human");
              }}
              role="tab"
            >
              Human-readable
            </button>
            <button
              className={view === "json" ? "active" : ""}
              onClick={() => {
                setView("json");
              }}
              role="tab"
            >
              Sanitized JSON
            </button>
          </div>
          {view === "human" ? (
            <ol className="dev-timeline">
              {lifecycle.map((item, index) => (
                <li key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <StatusBadge
                      tone={
                        item.status === "402"
                          ? "warning"
                          : item.status === "200" || item.status === "PASS"
                            ? "settled"
                            : "neutral"
                      }
                    >
                      {item.status}
                    </StatusBadge>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="code-panel">
              <div>
                <span>safe-x402-lifecycle.json</span>
                <button onClick={() => void navigator.clipboard.writeText(safeJson)}>
                  Copy sanitized JSON
                </button>
              </div>
              <pre>{safeJson}</pre>
            </div>
          )}
          <div className="evidence-actions">
            <a href={hashscanUrl(selected.transactionId)} target="_blank" rel="noreferrer">
              HashScan evidence ↗
            </a>
            <a href={mirrorUrl(selected.transactionId)} target="_blank" rel="noreferrer">
              Mirror-node record ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
