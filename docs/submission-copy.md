# Submission-ready copy

## Project name

AgriPay Agent

## Tagline

Autonomous intelligence, paid one insight at a time.

## 50-word summary

AgriPay Agent turns one agricultural question into safe, autonomous purchases of only the
intelligence required. Groq selects registered resources; deterministic policy controls payment.
Each provider returns HTTP 402, settles native HBAR on Hedera testnet, and delivers after proof.
Durable receipts make every decision, payment, and result independently inspectable.

## 150-word description

AgriPay Agent demonstrates how autonomous software can purchase granular digital resources without
subscriptions, API keys, or a human checkout. A user asks one natural-language question about
planting maize in Nandi. Groq produces a schema-validated plan selecting weather, disease, and
market resources from a fixed registry. A deterministic policy engine—not the model—then validates
testnet, recipient, asset, exact integer price, expiry, per-resource limits, and a 0.16 HBAR task
maximum. Each protected endpoint independently returns HTTP 402 Payment Required. The agent obtains
payment proof through a facilitator, settles native HBAR on Hedera testnet, retries the request,
and receives HTTP 200 only after verification. SQLite WAL state preserves tasks, idempotency,
replay protection, receipts, and ambiguous-settlement recovery across restarts. The responsive
interface exposes planning, 402 requirements, policy decisions, settlements, deliveries, synthesis,
and public HashScan evidence. Agricultural outputs are curated demonstration fixtures; the
architecture is designed for real provider integrations.

## Problem

Autonomous agents can discover information but cannot safely buy a one-off resource through
subscription checkout and human-oriented payment flows. Giving an LLM direct wallet authority is
unsafe, and buyers need exact budget control, delivery guarantees, and auditable evidence.

## Solution

AgriPay Agent separates intelligence from authority. Groq chooses registered resources relevant to
the question. Immutable registry metadata and deterministic policy alone control the payment. The
agent purchases each insight independently, validates delivery, synthesizes only delivered data,
and produces itemized public receipts.

## How x402 is implemented

Each registered resource is an actual protected HTTP endpoint. An unpaid request returns HTTP 402
with Hedera payment requirements. The client validates those requirements against its trusted
registry and policy, obtains a signed payment payload, asks the facilitator to verify and settle,
and retries the original request with proof. The resource returns HTTP 200 only after verified
settlement. Expiry, changed-price, duplicate, replay, asset, network, recipient, and exact-amount
checks are enforced. This repository intentionally uses the Hedera x402 v1 integration documented
in its ADR.

## How Hedera is used

Native HBAR is settled on Hedera testnet among separate buyer (`0.0.9676580`), seller
(`0.0.9676582`), and facilitator (`0.0.9676583`) roles. The facilitator submits the transaction and
pays the network fee; exact transfers are visible through HashScan and mirror node. Mainnet is
refused by configuration and policy.

## AI-agent behavior

Groq receives a bounded catalogue and must return schema-valid registered resource IDs. A
deterministic fallback preserves functionality when the model is unavailable. The LLM cannot set a
payment recipient, asset, network, or price, and final synthesis receives only validated delivered
resources.

## Security model

Live spending is disabled by default and requires operator authentication, a server-side session,
CSRF protection, and explicit maximum-spend confirmation. Strict CORS, CSP, security headers,
throttling, API rate limits, durable spending/concurrency controls, idempotency, replay persistence,
redacted logs, backups, and non-spending reconciliation reduce operational risk.

## Technical architecture

TypeScript pnpm monorepo; responsive React/Vite frontend; Node agent API, protected resource server,
and facilitator; Groq planner; deterministic policy engine; native Hedera SDK payment path; SQLite
WAL persistence; Nginx/TLS on a Contabo VPS; Vercel frontend.

## Key differentiators

- One natural-language question triggers three autonomous, independently settled purchases.
- The LLM selects resources but cannot authorize or mutate payment.
- Every resource exposes the visible 402 → policy → Hedera → 200 lifecycle.
- Replay protection, budgets, receipts, and recovery survive process restart.
- Buyer debit, seller credit, facilitator fee, and delivery are independently verifiable.
- Unsafe and over-budget payments are visibly rejected before signing.

## Public links

- Repository: <https://github.com/gethsun1/agripay-agent>
- Live application: <https://agripay-agent.vercel.app>
- Backend/API: <https://agripay-api.duckdns.org>
- Phase 1 HashScan: <https://hashscan.io/testnet/transaction/1784668506.369008592?tid=0.0.9676583-1784668506-369008592>
- Disease HashScan: <https://hashscan.io/testnet/transaction/1784671641.501210796?tid=0.0.9676583-1784671641-501210796>
- Weather HashScan: <https://hashscan.io/testnet/transaction/1784671645.343987679?tid=0.0.9676583-1784671645-343987679>
- Market HashScan: <https://hashscan.io/testnet/transaction/1784671645.928120887?tid=0.0.9676583-1784671645-928120887>
- Demo video: **[ADD FINAL PUBLIC VIDEO URL]**
- Builder/team: **[ADD BUILDER NAME, ROLE, LOCATION, AND CONTACT]**

## Roadmap

Integrate live agricultural providers with provenance and SLAs; simplify provider onboarding;
support richer delegated policies and provider discovery; add reliability telemetry; complete an
independent security review before any production-value or mainnet consideration.
