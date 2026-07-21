# Hedera testnet evidence

## Primary x402 resource-purchase transaction

- Recorded: 2026-07-21T21:15:12Z
- Resource: `weather-risk` for Nandi maize
- Protocol: x402 v1, exact native HBAR
- Buyer: `0.0.9676580`
- Seller: `0.0.9676582`
- Facilitator / fee payer: `0.0.9676583`
- Amount: 5,000,000 tinybars (0.05 HBAR)
- Transaction ID: `0.0.9676583@1784668506.369008592`
- [HashScan testnet transaction](https://hashscan.io/testnet/transaction/1784668506.369008592?tid=0.0.9676583-1784668506-369008592)
- [Hedera testnet mirror-node record](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.9676583-1784668506-369008592)

Independent mirror-node validation returned `SUCCESS`, a 5,000,000-tinybar debit from the buyer,
a 5,000,000-tinybar credit to the seller, and a separate fee debit from the facilitator. The
resource server returned HTTP 200 only after the SDK receipt confirmed settlement.

## Provisioned role accounts

These account-creation transactions are supporting setup evidence, not the bounty's primary
payment proof.

| Role        | Account                                                        | Initial balance | Creation transaction                                                                                                      |
| ----------- | -------------------------------------------------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------- |
| Buyer       | [0.0.9676580](https://hashscan.io/testnet/account/0.0.9676580) |        100 HBAR | [1784666822.478450743](https://hashscan.io/testnet/transaction/1784666822.478450743?tid=0.0.5226776-1784666822-478450743) |
| Seller      | [0.0.9676582](https://hashscan.io/testnet/account/0.0.9676582) |          5 HBAR | [1784666824.096769870](https://hashscan.io/testnet/transaction/1784666824.096769870?tid=0.0.5226776-1784666824-096769870) |
| Facilitator | [0.0.9676583](https://hashscan.io/testnet/account/0.0.9676583) |        100 HBAR | [1784666827.701835357](https://hashscan.io/testnet/transaction/1784666827.701835357?tid=0.0.5226776-1784666827-701835357) |

Testnet data can be reset by Hedera. Transaction IDs and links are intentionally public; no
keys, raw signed payloads, or authorization material are recorded here.
