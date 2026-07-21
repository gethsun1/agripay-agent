import { Link } from "react-router-dom";
import { Flow } from "../components/Flow";
import { SectionHead, StatusBadge } from "../components/Layout";
import { evidence, hashscanUrl, resources } from "../lib/data";
export function Landing() {
  return (
    <>
      <section className="hero grid-pattern">
        <div className="hero-copy">
          <div className="eyebrow-row">
            <StatusBadge tone="live">Hedera testnet ready</StatusBadge>
            <span>Autonomous procurement · bounded spend</span>
          </div>
          <p className="kicker">Agricultural intelligence infrastructure</p>
          <h1>
            Autonomous intelligence,
            <br />
            <em>paid one insight at a time.</em>
          </h1>
          <p className="hero-lede">
            Ask one question. AgriPay selects only the intelligence it needs, authorizes exact
            costs, settles each resource independently, and returns a decision brief with public
            proof.
          </p>
          <div className="actions">
            <Link className="button" to="/agent">
              Ask the Agent <span>→</span>
            </Link>
            <Link className="button button-ghost" to="/developer">
              Inspect the payment flow
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <b>0.16 HBAR</b> max three-resource demo
            </span>
            <span>
              <b>3</b> independently settled resources
            </span>
            <span>
              <b>0</b> subscriptions
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-label="AgriPay protocol overview">
          <div className="orbit">
            <div className="field-lines" />
            <div className="core">
              <span>AGENT TASK</span>
              <b>Question → intelligence</b>
              <small>Policy-bound autonomy</small>
            </div>
            {resources.map((r, i) => (
              <div className={`orbit-card orbit-${String(i)}`} key={r.id}>
                <span>{r.eyebrow}</span>
                <b>{r.name}</b>
                <small>{r.priceHbar} HBAR</small>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="page-section">
        <SectionHead
          kicker="Paid intelligence catalogue"
          title="Buy the signal. Keep the evidence."
          body="Every resource has a fixed registry price, schema-validated output, and an independent settlement trail."
        />
        <div className="resource-grid">
          {resources.map((r, index) => (
            <article className="resource-card" key={r.id}>
              <div className="resource-index">0{index + 1}</div>
              <p className="kicker">{r.eyebrow}</p>
              <h3>{r.name}</h3>
              <p>{r.description}</p>
              <div className="price">
                <b>{r.priceHbar}</b>
                <span>
                  HBAR
                  <br />
                  {Number(r.priceTinybars).toLocaleString()} tinybars
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="page-section flow-section">
        <SectionHead
          kicker="One transparent lifecycle"
          title="The protocol is the product."
          body="No invisible checkout. Every transition—from intent to delivered intelligence—is inspectable."
        />
        <Flow />
      </section>
      <section className="split-section">
        <div>
          <p className="kicker">Why pay per use</p>
          <h2>Intelligence without another subscription.</h2>
          <p>
            Resources compete at the request level. The agent buys only what the task needs, while
            deterministic controls cap the total before a signature exists.
          </p>
          <ul className="check-list">
            <li>Exact integer-tinybar pricing</li>
            <li>Changed-price refusal</li>
            <li>Durable replay prevention</li>
            <li>Independent public verification</li>
          </ul>
        </div>
        <div className="control-card">
          <span className="card-label">PAYMENT CONTROL CENTRE</span>
          <div className="meter-head">
            <span>Maximum task exposure</span>
            <b>0.16 HBAR</b>
          </div>
          <div className="meter">
            <span style={{ width: "53%" }} />
          </div>
          <dl>
            <div>
              <dt>Network</dt>
              <dd>Hedera testnet</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>Native HBAR</dd>
            </div>
            <div>
              <dt>Payments</dt>
              <dd>Maximum 3</dd>
            </div>
            <div>
              <dt>Authorization</dt>
              <dd>Deterministic policy</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="evidence-band">
        <div>
          <p className="kicker">Verified testnet evidence</p>
          <h2>Public proof, not a promise.</h2>
          <p>
            Historical Phase 2 transactions. Inspecting these records never initiates a payment.
          </p>
        </div>
        <div className="evidence-list">
          {evidence.slice(0, 3).map((item) => (
            <a
              key={item.transactionId}
              href={hashscanUrl(item.transactionId)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{item.resource}</span>
              <code>{item.transactionId}</code>
              <b>{item.amountHbar} HBAR ↗</b>
            </a>
          ))}
        </div>
      </section>
      <section className="cta-section">
        <p className="kicker">Ready when you are</p>
        <h2>Turn a farm decision into a verifiable task.</h2>
        <p>
          Start in demonstration mode. Live testnet execution always requires an explicit
          maximum-spend confirmation.
        </p>
        <Link className="button" to="/agent">
          Open agent workspace →
        </Link>
      </section>
    </>
  );
}
