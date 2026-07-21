# ADR 0003: Durable sequential multi-resource orchestration

Status: accepted

Node 24 built-in SQLite is used to avoid a native add-on or external database during the bounty
demo. WAL and transactional uniqueness provide restart-safe replay protection. Resources settle
sequentially because correctness, evidence, and bounded recovery matter more than payment
parallelism. Groq can propose registered IDs and synthesize validated data, but registry and
policy code own every authority-bearing field. Mirror-node lookup resolves ambiguous submitted
transactions before any retry.
