# 0001. Record Architecture Decisions

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Ogechukwu Flagg-Igbo

## Context

Green Initiatives is evolving from a CRUD/fintech app into a production-grade personal ESG micro-investing and AI-assisted verification platform (integrating Plaid, Alpaca, double-entry ledger accounting, hybrid vector/geospatial search, and LLM evals). Important design trade-offs—such as deterministic rules vs. LLM fallbacks, idempotent financial state machines, and brokerage routing—should be documented alongside the code.

## Decision

We will maintain lightweight Architecture Decision Records (ADRs) in `docs/adr/` using [adr-template.md](adr-template.md) and sequential four-digit numbering (`0001-`, `0002-`, ...).

## Consequences

### Positive

- Preserves the "why" behind key trade-offs for future contributors and technical interviews.
- Keeps architectural context version-controlled next to the implementation.

### Negative / Trade-offs

- Requires a small amount of discipline to update or supersede ADRs when major designs change.
