# Four-minute demo video package

Target duration: **3:55**. Record at 1440p with browser zoom at 100–110%. Never show a terminal
containing environment variables, credentials, private keys, cookies, or the operator passphrase.

## Tabs to open before recording

1. `https://agripay-agent.vercel.app`
2. `https://agripay-agent.vercel.app/agent`
3. `https://agripay-agent.vercel.app/developer`
4. `https://agripay-agent.vercel.app/receipts`
5. The three HashScan links in `docs/hashscan-evidence.md`

Keep the recorded-evidence path loaded as the network-safe fallback. Use the live testnet control
only after the pre-demo checklist and operator authentication; live payment must remain disabled
before and after recording unless deliberately enabled for the single authorized run.

## Timeline, narration, and clicks

### 0:00–0:20 — Hook

**Click:** Landing page hero, then slowly reveal the lifecycle.

**Say:** “AI agents can find information, but autonomous commerce requires them to pay safely for
exactly what they use. AgriPay Agent turns one farmer question into granular, policy-controlled
purchases through x402 and Hedera.”

### 0:20–0:40 — Product

**Click:** Open `/agent`; paste: “Should I plant maize in Nandi this week, what disease risks
should I prepare for, and what is the market outlook?”

**Say:** “This one question needs weather, disease, and market intelligence. Groq selects only
registered providers. Before anything can spend, the deterministic preflight fixes the maximum at
16 million tinybars—0.16 HBAR.”

### 0:40–1:05 — Planning and safety

**Click:** Show the three resources and exact itemized preflight. Pause on the confirmation gate.

**Say:** “The model proposes a plan; it never controls the wallet. The registry fixes recipient,
asset, network, and price. Policy enforces per-resource and total budgets, testnet only, expiry,
idempotency, and replay protection.”

### 1:05–2:15 — x402 lifecycle

**Click:** Run the prepared flow. Follow the timeline for each resource. Pause two seconds on each
402 and receipt.

**Say:** “The first protected request returns a genuine HTTP 402 with payment requirements. Policy
validates them, the facilitator verifies and settles native HBAR, and the agent retries with proof.
Only then does the resource return HTTP 200. The same lifecycle happens independently for disease,
weather, and market data—three purchases, not a disguised checkout.”

If the network is slow after 12 seconds, switch to `/developer`, select verified evidence, and say:
“To keep this recording deterministic, here is the committed receipt from the previously verified
testnet run; every transaction remains public.”

### 2:15–2:45 — On-chain proof

**Click:** Open each HashScan tab; on one transaction show transfers and fee.

**Say:** “These are three separate Hedera testnet transactions. The buyer pays, the seller receives
the exact resource price, and the facilitator account pays the network fee. HashScan and mirror
node independently expose the evidence.”

### 2:45–3:15 — Result

**Click:** Return to the completed task and itemized receipts.

**Say:** “Only delivered resources enter synthesis. The result is a clearly labelled demonstration
agricultural brief, with the exact spend and a receipt for every purchased insight. Partial delivery
would remain visible instead of being hidden.”

### 3:15–3:40 — Security differentiation

**Click:** Open `/developer`; show sanitized requirements and policy decision, then the rejected
over-budget example.

**Say:** “The LLM cannot change amount or recipient. An unsafe or over-budget purchase is rejected
before signing. Durable SQLite state preserves replay protection and ambiguous-settlement recovery
across restarts, so the agent never blindly pays twice.”

### 3:40–3:55 — Close

**Click:** Return to the lifecycle diagram.

**Say:** “AgriPay Agent makes autonomous commerce inspectable: plan, 402, policy, Hedera settlement,
200, and proof. Hedera’s predictable fees and fast finality make pay-per-call intelligence
economically practical.”

## Recording checklists

Before: run `pnpm demo:preflight`; verify a fresh database backup; confirm testnet accounts and
0.16 HBAR cap; confirm unrelated VPS services healthy; silence notifications; close password
managers and private tabs; rehearse once.

Audio: quiet room, external microphone if available, -12 to -6 dB peaks, no clipping, one test
playback, speak at a measured pace.

Privacy: no DevTools storage/cookies, shell history, `.env`, server logs with request metadata,
passphrase, keys, personal bookmarks, or notification previews.

After: follow `docs/post-demo-checklist.md`, trim dead time, verify duration under 5:00, check every
URL and transaction ID at full resolution, add captions, and export 1080p or higher.
