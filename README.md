# Green Initiatives

Minimal Acorns-style ESG micro-investing app on the **MERN** stack (MongoDB, Express, React, Node.js):

1. **Plaid** — Links your bank account and syncs posted transactions via `/transactions/sync`.
2. **Round-Ups** — Rounds each debit up to the nearest dollar until your balance reaches **$5.00**.
3. **Alpaca Trading API** — Invests accumulated round-ups into fractional ESG ETF baskets (`ICLN`, `TAN`, `NEE`, `ESGU`, `USSG`, `PHO`, `WM`).

No extra third-party services—auth (`node:crypto`), HTTP calls (`fetch`), and tests (`node:test`) all use native Node.js APIs.

## Quick Start

```bash
npm install
cp .env.example .env   # Optional: leave blank to run with in-memory MongoDB + Plaid/Alpaca sandbox mocks
npm run dev            # http://localhost:8000
```

## Scripts

```bash
npm run check          # TypeScript typecheck
npm test               # Native node:test unit tests
npm run test:e2e       # Recorded Playwright E2E flow (recordings/e2e-playwright-flow.webm)
npm run screenshots    # Regenerate Playwright UI screenshots (screenshots/)
npm run build          # Production client + server build
```

## Architecture

- `server/` — Express API, Mongoose models, native crypto auth, Plaid & Alpaca `fetch()` services
- `client/` — React + Tailwind CSS UI (Auth, Portfolio, Bank & ESG Basket)
- `shared/` — Shared TypeScript types
- `docs/adr/` — Architecture Decision Records
