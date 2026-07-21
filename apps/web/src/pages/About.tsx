import { Flow } from "../components/Flow";
import { SectionHead, StatusBadge } from "../components/Layout";
export function About() {
  return (
    <div className="inner-page">
      <header className="page-hero">
        <StatusBadge tone="safe">Safety by architecture</StatusBadge>
        <p className="kicker">About AgriPay</p>
        <h1>A trustworthy market for machine-readable intelligence.</h1>
        <p>
          AgriPay demonstrates how an autonomous agent can procure narrow, useful data without
          surrendering payment authority to a language model.
        </p>
      </header>
      <section className="page-section no-pad">
        <div className="problem-grid">
          <article>
            <span>01 / Problem</span>
            <h2>Subscriptions mismatch agent economics.</h2>
            <p>
              Software agents need small, auditable purchases at the moment a decision is made—not
              seats, dashboards, or opaque monthly bundles.
            </p>
          </article>
          <article>
            <span>02 / Solution</span>
            <h2>HTTP-native payment, policy-bound.</h2>
            <p>
              x402 lets a resource state its terms at request time. Hedera testnet makes each
              approved settlement fast, exact, and publicly inspectable.
            </p>
          </article>
        </div>
      </section>
      <section className="page-section no-pad">
        <SectionHead kicker="Architecture" title="Separation is the safety mechanism." />
        <div className="architecture">
          <article>
            <b>01</b>
            <h3>Buyer agent</h3>
            <p>Plans a task and signs only after deterministic authorization.</p>
          </article>
          <span>402 / retry</span>
          <article>
            <b>02</b>
            <h3>Resource server</h3>
            <p>Publishes registered terms and releases validated intelligence after proof.</p>
          </article>
          <span>verify / settle</span>
          <article>
            <b>03</b>
            <h3>Facilitator</h3>
            <p>Verifies exact transfers, prevents replay, and submits to Hedera testnet.</p>
          </article>
        </div>
        <Flow />
      </section>
      <section className="principles">
        <div>
          <p className="kicker">Control boundary</p>
          <h2>
            Groq proposes.
            <br />
            Policy disposes.
          </h2>
        </div>
        <div className="principle-list">
          <article>
            <b>Groq’s limited role</b>
            <p>
              It recommends registered resource IDs and synthesizes only validated delivered data.
              It never controls prices, URLs, sellers, assets, networks, or keys.
            </p>
          </article>
          <article>
            <b>Durable replay protection</b>
            <p>
              SQLite WAL, transactional claims, and unique digests survive restarts and settlement
              races.
            </p>
          </article>
          <article>
            <b>Ambiguous recovery</b>
            <p>
              Submitted transactions are reconciled through the mirror node. The system never
              blindly pays twice.
            </p>
          </article>
          <article>
            <b>Demonstration disclosure</b>
            <p>
              Weather, disease, and market outputs are curated fixtures—not live advice or
              professional recommendations.
            </p>
          </article>
        </div>
      </section>
      <section className="roadmap">
        <p className="kicker">Roadmap</p>
        <h2>From verified demo to production rail.</h2>
        <div>
          <span>
            Now
            <br />
            <b>Durable testnet protocol</b>
          </span>
          <span>
            Next
            <br />
            <b>Authentication & operational hardening</b>
          </span>
          <span>
            Later
            <br />
            <b>Provider marketplace & live data</b>
          </span>
        </div>
      </section>
    </div>
  );
}
