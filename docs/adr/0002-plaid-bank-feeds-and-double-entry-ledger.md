# 0002. Use Plaid Link & Double-Entry Ledger for Round-Up Accounting

- **Status:** Proposed
- **Date:** 2026-11-27
- **Deciders:** Ogechukwu Flagg-Igbo

## Context

The initial prototype used a simulated Teller Connect modal and a single mutable `User.roundUpBalanceCents` counter for round-up accumulation. Moving toward real bank feeds and real-money micro-investing introduces three requirements:

1. Reuse an existing Plaid developer account and integration pattern (`PLAID_CLIENT_ID` / `PLAID_SECRET` + cursor-based `/transactions/sync`).
2. Handle real-world card settlement edge cases (`pending` vs. `posted` transaction deltas) without double-counting webhook retries or overlapping syncs.
3. Maintain an auditable financial ledger so every cent is traceable across `ACCRUED`, `PENDING_SETTLEMENT`, `INVESTED`, and `FAILED` states.

## Decision

1. **Bank Connectivity:** Standardize on **Plaid Link** (`server/services/plaid.service.ts`) with encrypted `access_token` storage, cursor-based `/transactions/sync`, and unique indexing on `plaidTransactionId`. Lock round-up deltas only once `pending === false`.
2. **Accounting:** Introduce an append-only double-entry `ledger_entries` collection (`server/services/ledger.service.ts`) keyed by `idempotencyKey` and updated inside MongoDB transactions.
3. **Hybrid Carbon Classification:** Classify merchant spend using fast deterministic rules/regex first, falling back to a lightweight LLM classifier only for unrecognized strings, with graceful degradation to a `1x` multiplier on timeout.

## Alternatives Considered

- **Teller Connect (mTLS):** Requires separate certificate management (`cert.pem` / `private_key.pem`) and a second banking aggregator account when Plaid is already configured and in use.
- **Single mutable balance counter:** Insufficient auditability and vulnerable to race conditions or partial failures during cron flushes.

## Consequences

### Positive

- Reuses existing Plaid infrastructure and avoids mTLS cert rotation overhead.
- Guarantees idempotency and auditability for every round-up cent.
- Minimizes LLM cost and latency via rules-first transaction categorization.

### Negative / Trade-offs

- Requires MongoDB replica set support (or Atlas) for multi-document transactions in production.
- Adds schema and migration work to reconcile legacy `roundUpBalanceCents` with `ledger_entries`.
