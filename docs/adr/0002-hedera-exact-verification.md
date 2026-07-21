# ADR 0002: Strict application validation around Hedera x402 alpha

- Status: Accepted
- Date: 2026-07-21

## Context

The pinned `hedera-dev/x402-hedera` x402 0.6.6 implementation constructs a buyer-signed HBAR
transfer whose transaction payer is the facilitator. Its verifier checks the scheme, network,
transfer type, and facilitator transaction ID. At commit `d11dc65…`, the HBAR validation code
explicitly performs only basic asset validation and does not inspect recipient or amount.

## Decision

AgriPay adapts the upstream flow under Apache-2.0 and adds strict checks before settlement:

- testnet, exact scheme, and HBAR only;
- facilitator account equals the configured fee payer;
- exactly two HBAR transfer entries;
- exact buyer debit and seller credit in integer tinybars;
- presence of the configured buyer public-key signature;
- expiry, registered price, resource, seller, and replay checks;
- nonce reservation during settlement to prevent concurrent duplicate submission;
- definitive Hedera SDK receipt before `settled`; ambiguity prevents delivery.

The signed transaction is never persisted or exposed. Only sanitized lifecycle events and the
public settlement receipt are stored.
