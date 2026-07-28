# Hedera testnet evidence

## Final controlled demo

Recorded 2026-07-29. Task `99fe2e5d-b4de-44bb-b93b-6acf0fcdcdb6` used a schema-valid Groq
plan, but the model selected two resources rather than the requested three. The deterministic
preflight approved the selected 11,000,000-tinybar total. Both resources independently followed
HTTP 402 → policy approval → verified settlement → payment-proof retry → validated HTTP 200,
and the final Groq synthesis completed. No weather payment was attempted.

| Resource              | Amount (tinybars) | Transaction ID                     | Public evidence                                                                                                                                                                                  | Delivery |
| --------------------- | ----------------: | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `market-intelligence` |         4,000,000 | `0.0.9676583@1785273583.252225695` | [HashScan](https://hashscan.io/testnet/transaction/0.0.9676583-1785273583-252225695) · [mirror node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1785273583-252225695) | HTTP 200 |
| `disease-risk`        |         7,000,000 | `0.0.9676583@1785273586.910008234` | [HashScan](https://hashscan.io/testnet/transaction/0.0.9676583-1785273586-910008234) · [mirror node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1785273586-910008234) | HTTP 200 |

Independent mirror-node queries returned `SUCCESS` and exact buyer debits/seller credits of
4,000,000 and 7,000,000 tinybars. Total resource spend was 11,000,000 tinybars (0.11 HBAR).
Live payments were disabled immediately after the task reached its terminal state.

## Phase 2 multi-resource task

Recorded 2026-07-22. Groq (`llama-3.3-70b-versatile`) returned a schema-valid plan for all three
registered resources. The deterministic preflight approved exactly 16,000,000 tinybars. Every
resource independently followed HTTP 402 → verified settlement → retry → validated HTTP 200;
the final task and Groq synthesis completed.

| Resource              | Amount (tinybars) | Transaction ID                     | Public evidence                                                                                                                                                                                  | Delivery |
| --------------------- | ----------------: | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `disease-risk`        |         7,000,000 | `0.0.9676583@1784671641.501210796` | [HashScan](https://hashscan.io/testnet/transaction/0.0.9676583-1784671641-501210796) · [mirror node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784671641-501210796) | HTTP 200 |
| `weather-risk`        |         5,000,000 | `0.0.9676583@1784671645.343987679` | [HashScan](https://hashscan.io/testnet/transaction/0.0.9676583-1784671645-343987679) · [mirror node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784671645-343987679) | HTTP 200 |
| `market-intelligence` |         4,000,000 | `0.0.9676583@1784671645.928120887` | [HashScan](https://hashscan.io/testnet/transaction/0.0.9676583-1784671645-928120887) · [mirror node](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784671645-928120887) | HTTP 200 |

Independent mirror-node queries returned `SUCCESS` and exact buyer debits/seller credits of
7,000,000, 5,000,000, and 4,000,000 tinybars respectively. Each transaction also has a distinct
facilitator fee debit. Total resource spend was 16,000,000 tinybars (0.16 HBAR).

The records below are Phase 1 evidence and are not part of the Phase 2 three-resource total.

## Primary x402 resource-purchase transaction

- Recorded: 2026-07-21T21:15:12Z
- Resource: `weather-risk` for Nandi maize
- Protocol: x402 v1, exact native HBAR
- Buyer: `0.0.9676580`
- Seller: `0.0.9676582`
- Facilitator / fee payer: `0.0.9676583`
- Amount: 5,000,000 tinybars (0.05 HBAR)
- Transaction ID: `0.0.9676583@1784668506.369008592`
- [HashScan testnet transaction](https://hashscan.io/testnet/transaction/0.0.9676583-1784668506-369008592)
- [Hedera testnet mirror-node record](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784668506-369008592)

Independent mirror-node validation returned `SUCCESS`, a 5,000,000-tinybar debit from the buyer,
a 5,000,000-tinybar credit to the seller, and a separate fee debit from the facilitator. The
resource server returned HTTP 200 only after the SDK receipt confirmed settlement.

## Provisioned role accounts

These account-creation transactions are supporting setup evidence, not the bounty's primary
payment proof.

| Role        | Account                                                        | Initial balance | Creation transaction                                                                             |
| ----------- | -------------------------------------------------------------- | --------------: | ------------------------------------------------------------------------------------------------ |
| Buyer       | [0.0.9676580](https://hashscan.io/testnet/account/0.0.9676580) |        100 HBAR | [1784666822.478450743](https://hashscan.io/testnet/transaction/0.0.5226776-1784666822-478450743) |
| Seller      | [0.0.9676582](https://hashscan.io/testnet/account/0.0.9676582) |          5 HBAR | [1784666824.096769870](https://hashscan.io/testnet/transaction/0.0.5226776-1784666824-096769870) |
| Facilitator | [0.0.9676583](https://hashscan.io/testnet/account/0.0.9676583) |        100 HBAR | [1784666827.701835357](https://hashscan.io/testnet/transaction/0.0.5226776-1784666827-701835357) |

Testnet data can be reset by Hedera. Transaction IDs and links are intentionally public; no
keys, raw signed payloads, or authorization material are recorded here.
