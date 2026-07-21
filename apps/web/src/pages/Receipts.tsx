import { useMemo, useState } from "react";
import { StatusBadge } from "../components/Layout";
import { evidence, hashscanUrl, mirrorUrl, resources } from "../lib/data";
export function Receipts() {
  const [query, setQuery] = useState("");
  const [resource, setResource] = useState("all");
  const [selected, setSelected] = useState<(typeof evidence)[number] | null>(null);
  const rows = useMemo(
    () =>
      evidence.filter(
        (item) =>
          (resource === "all" || item.resourceId === resource) &&
          `${item.taskId} ${item.resourceId} ${item.transactionId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, resource],
  );
  return (
    <div className="inner-page">
      <header className="page-hero compact">
        <StatusBadge tone="live">Public evidence only</StatusBadge>
        <p className="kicker">Receipt explorer</p>
        <h1>Every payment tells the whole story.</h1>
        <p>
          Search committed Hedera testnet receipts. Viewing this page cannot create a task or
          initiate payment.
        </p>
      </header>
      <section className="page-section no-pad">
        <div className="toolbar">
          <label>
            Search receipts
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Task, resource or transaction ID"
            />
          </label>
          <label>
            Resource
            <select
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
              }}
            >
              <option value="all">All resources</option>
              {resources.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <span>
            {rows.length} receipt{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {rows.length ? (
          <div className="receipt-list">
            {rows.map((item) => (
              <article className="receipt-row" key={item.transactionId}>
                <div>
                  <StatusBadge tone="settled">{item.kind}</StatusBadge>
                  <h3>{item.resource}</h3>
                  <code>{item.transactionId}</code>
                </div>
                <div className="http-flow">
                  <b>402</b>
                  <span>settled</span>
                  <b>200</b>
                </div>
                <div>
                  <small>AMOUNT</small>
                  <b>{item.amountHbar} HBAR</b>
                  <span>{Number(item.amountTinybars).toLocaleString()} tinybars</span>
                </div>
                <div>
                  <small>STATE</small>
                  <b>Settled · Delivered</b>
                  <span>{item.timestamp}</span>
                </div>
                <button
                  className="button button-ghost button-small"
                  onClick={() => {
                    setSelected(item);
                  }}
                >
                  Inspect
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <b>No receipts match</b>
            <p>Try a different task, resource, or transaction ID.</p>
          </div>
        )}
      </section>
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            setSelected(null);
          }}
        >
          <section
            className="receipt-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              className="close"
              onClick={() => {
                setSelected(null);
              }}
              aria-label="Close receipt"
            >
              ×
            </button>
            <StatusBadge tone="settled">Real Hedera testnet receipt</StatusBadge>
            <h2 id="receipt-title">{selected.resource}</h2>
            <p className="muted">Historical verified evidence · not currently executing</p>
            <div className="detail-flow">
              <span>HTTP 402</span>
              <span>Policy approved</span>
              <span>Settlement verified</span>
              <span>HTTP 200 delivered</span>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Task</dt>
                <dd>{selected.taskId}</dd>
              </div>
              <div>
                <dt>Plan source</dt>
                <dd>{selected.planSource}</dd>
              </div>
              <div>
                <dt>Buyer</dt>
                <dd>{selected.buyer}</dd>
              </div>
              <div>
                <dt>Seller</dt>
                <dd>{selected.seller}</dd>
              </div>
              <div>
                <dt>Facilitator</dt>
                <dd>{selected.facilitator}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{selected.amountHbar} HBAR</dd>
              </div>
              <div className="wide">
                <dt>Transaction</dt>
                <dd>
                  <code>{selected.transactionId}</code>
                </dd>
              </div>
            </dl>
            <div className="actions">
              <a
                className="button"
                href={hashscanUrl(selected.transactionId)}
                target="_blank"
                rel="noreferrer"
              >
                Open HashScan ↗
              </a>
              <a
                className="button button-ghost"
                href={mirrorUrl(selected.transactionId)}
                target="_blank"
                rel="noreferrer"
              >
                Mirror node ↗
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
