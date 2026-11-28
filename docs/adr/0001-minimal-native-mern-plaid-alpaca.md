# 0001. Minimal Native MERN Stack with Plaid & Alpaca Only

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

Green Initiatives pivoted from a broad charitable-donations portal into a focused Acorns-style personal ESG micro-investing app. Keeping the foundation minimal and native makes it fast to iterate on while sketching out the full production architecture.

## Decision

- **Third-party integrations limited to two:** **Plaid** (bank linking & transaction sync) and **Alpaca Trading API** (fractional ESG ETF orders & portfolio positions), both called with native `fetch()`.
- **Native Node.js wherever possible:** `node:crypto` (`scryptSync` + HMAC-SHA256 cookies) for auth, `node:test` for unit tests, `--env-file-if-exists=.env` for env loading.
- **MERN core:** MongoDB (`mongoose` via Docker locally or managed URI in production), Redis (`redis` for OTP/MFA cache), Express, React + Tailwind CSS, Node.js.

## Consequences

- **Pros:** Tiny dependency tree (4 runtime packages), fast startup, easy to reason about and extend.
- **Trade-offs:** Production hardening (KMS token encryption, Plaid webhook verification, Alpaca market-hours queue, double-entry MongoDB transactions) will be added incrementally as separate ADRs.
