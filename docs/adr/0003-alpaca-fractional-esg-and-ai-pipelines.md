# 0003. Fractional ESG Investing via Alpaca & Structured AI Pipelines

- **Status:** Proposed
- **Date:** 2026-11-27
- **Deciders:** Ogechukwu Flagg-Igbo

## Context

When accumulated round-ups cross the $5 threshold, the current cron (`/api/cron/flush-roundups`) distributes mock donations across projects. To support personal ESG micro-investing and production-grade AI features:

- Brokerage execution must support $1+ fractional share orders (`notional`) and handle US market hours (queueing weekend/after-hours flushes for market open).
- AI features (proposal PDF vetting, ESG holdings screening, natural-language portfolio rebalancing, and comment pre-moderation) must have strict schema guardrails, observability, and regression evals rather than ad-hoc prompting.

## Decision

1. **Brokerage Execution:** Integrate **Alpaca Trading API** (`server/services/alpaca.service.ts`) starting with Paper Trading (`https://paper-api.alpaca.markets`), routing $5+ flushes into weighted ESG ETF sleeves (`ICLN`, `TAN`, `NEE`, `ESGU`, `USSG`, `PHO`, `WM`) via `POST /v2/orders` with `notional`, `time_in_force: "day"`, and deterministic `client_order_id` idempotency keys.
2. **Structured AI & Guardrails:** Enforce **Zod** schemas on all LLM outputs (`extractedProposalSchema`, `rebalancedAllocationSchema`), log token/latency/fallback telemetry via `logger.logAiTelemetry()`, and gate prompt/model changes with golden-dataset evals (`npm run test:evals`).
3. **Hybrid Search (RAG):** Pair MongoDB Atlas Vector Search with existing `$geoNear` and environment/approval filters (`projectService.hybridSearchProjects`).

## Alternatives Considered

- **Charitable-only mock donations:** Does not execute real fractional trades or demonstrate brokerage state-machine / tax-lot engineering.
- **Unstructured LLM JSON parsing:** Prone to silent schema drift and invalid portfolio weights (e.g. weights not summing to 1.0).

## Consequences

### Positive

- Real fractional investing testable risk-free on Alpaca Paper Trading.
- Deterministic validation and CI evals keep AI features reliable in production.

### Negative / Trade-offs

- Fractional `notional` orders on Alpaca are restricted to regular market hours, requiring a `PENDING_SETTLEMENT` queue for weekend/after-hours flushes.
- Requires managing API keys and budget/rate limits for Alpaca and the LLM provider.
