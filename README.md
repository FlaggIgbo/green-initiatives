# Green Initiatives

Minimal Acorns-style ESG micro-investing app on the **MERN** stack (MongoDB, Express, React, Node.js):

1. **Plaid** — Links your bank account and syncs posted transactions via `/transactions/sync`.
2. **Round-Ups** — Rounds each debit up to the nearest dollar until your balance reaches **$5.00**.
3. **Alpaca Trading API** — Invests accumulated round-ups into fractional ESG ETF baskets (`ICLN`, `TAN`, `NEE`, `ESGU`, `USSG`, `PHO`, `WM`).

No extra third-party services—auth (`node:crypto`), HTTP calls (`fetch`), and tests (`node:test`) all use native Node.js APIs.

## Quick Start (Docker for MongoDB & Redis)

```bash
npm install
cp .env.example .env      # Preconfigured for local Docker MongoDB + Redis
npm run services:up       # Starts MongoDB (27017) & Redis (6379) via Docker Compose
npm run dev               # http://localhost:8000
```

> **Required services:** `MONGODB_URI` and `REDIS_URL` are always required—there is no in-memory fallback. Run `npm run services:up` locally or supply live production URLs.

To build and run the full production container stack (`app` + `mongodb` + `redis`):

```bash
docker compose --profile full up --build
```

## Component Gallery

Every UI component can be viewed and tested in isolation:

- Full gallery: `http://localhost:8000/?showcase=1`
- Single component: `http://localhost:8000/?component=<id>` (e.g. `holdings-table`, `roundup-progress-card`, `esg-basket-selector`)

## Scripts

```bash
npm run services:up    # Start local MongoDB & Redis containers
npm run services:down  # Stop local Docker services
npm run check          # TypeScript typecheck
npm test               # Native node:test unit & React component tests
npm run test:e2e       # Recorded Playwright E2E flow (recordings/e2e-playwright-flow.webm)
npm run screenshots    # Regenerate Playwright page & component screenshots (screenshots/)
npm run build          # Production client + server build
```

## Architecture

- `server/` — Express API, Mongoose models, native crypto auth, Redis OTP cache, Plaid & Alpaca `fetch()` services
- `client/src/components/` — Modular React + Tailwind components (`ui/`, `auth/`, `portfolio/`, `settings/`)
- `client/src/pages/` — Collated page views (`AuthPage`, `PortfolioPage`, `SettingsPage`)
- `client/src/showcase/` — Isolated component gallery for visual review & screenshot testing
- `shared/` — Shared TypeScript types
- `docs/adr/` — Architecture Decision Records
