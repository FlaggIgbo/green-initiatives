import type { EsgBasket, PortfolioPosition } from "@shared/schema-mongo";

/**
 * Alpaca Trading API Service (Stubs)
 *
 * Routes accumulated round-up flushes into fractional ESG ETF/equity baskets
 * using Alpaca's notional market orders (Paper Trading first, then Live).
 */

export const DEFAULT_ESG_BASKETS: EsgBasket[] = [
  {
    id: "clean-energy-grid",
    name: "Clean Energy & Grid",
    description: "Solar, clean energy infrastructure, and renewable utilities",
    holdings: [
      { symbol: "ICLN", weight: 0.4, name: "iShares Global Clean Energy ETF" },
      { symbol: "TAN", weight: 0.3, name: "Invesco Solar ETF" },
      { symbol: "NEE", weight: 0.3, name: "NextEra Energy" },
    ],
  },
  {
    id: "broad-esg-core",
    name: "Broad ESG Core",
    description: "Diversified US large-cap ESG screened equities",
    holdings: [
      { symbol: "ESGU", weight: 0.6, name: "iShares ESG Aware MSCI USA ETF" },
      { symbol: "USSG", weight: 0.4, name: "Xtrackers MSCI USA ESG Leaders Equity ETF" },
    ],
  },
  {
    id: "water-circular-economy",
    name: "Water & Circular Economy",
    description: "Water infrastructure and waste/recycling leaders",
    holdings: [
      { symbol: "PHO", weight: 0.5, name: "Invesco Water Resources ETF" },
      { symbol: "WM", weight: 0.5, name: "Waste Management" },
    ],
  },
];

export interface FractionalOrderParams {
  symbol: string;
  notionalUsd: number;
  idempotencyKey: string;
}

export interface FractionalOrderResult {
  orderId: string;
  symbol: string;
  notionalUsd: number;
  status: string;
}

export class AlpacaService {
  /**
   * GET /v2/clock
   * TODO: Check Alpaca market clock. Fractional `notional` orders only execute as `day` orders
   * during regular market hours; queue weekend/after-hours flushes to execute at 9:35 AM ET.
   */
  async isMarketOpen(): Promise<{ isOpen: boolean; nextOpenIso: string }> {
    throw new Error("TODO: Implement AlpacaService.isMarketOpen via GET /v2/clock");
  }

  /**
   * POST /v2/orders
   * TODO:
   * 1. Enforce minimum $1.00 notional per order
   * 2. Submit market buy order with `notional`, `time_in_force: "day"`, and `client_order_id: idempotencyKey`
   * 3. Handle retries idempotently using `client_order_id`
   */
  async submitFractionalOrder(_params: FractionalOrderParams): Promise<FractionalOrderResult> {
    throw new Error("TODO: Implement AlpacaService.submitFractionalOrder via POST /v2/orders");
  }

  /**
   * Split an accumulated round-up flush across a user's selected ESG basket weights.
   * TODO:
   * 1. Look up user's target EsgBasket (or custom rebalanced weights)
   * 2. Check `isMarketOpen()`; if closed, persist batch as PENDING_SETTLEMENT for next market open
   * 3. Submit fractional orders for each leg with deterministic per-leg idempotency keys
   * 4. Record INVESTED / FAILED entries in LedgerService
   */
  async executeBasketOrders(
    _userId: string,
    _basketId: string,
    _amountCents: number,
    _idempotencyKey: string,
  ): Promise<FractionalOrderResult[]> {
    throw new Error("TODO: Implement AlpacaService.executeBasketOrders");
  }

  /**
   * GET /v2/positions
   * TODO: Fetch live holdings, cost basis, and unrealized P&L to power /profile charts.
   */
  async getPortfolioPositions(_userId: string): Promise<PortfolioPosition[]> {
    throw new Error("TODO: Implement AlpacaService.getPortfolioPositions via GET /v2/positions");
  }

  /**
   * GET /v2/account/activities
   * TODO: Pull fills, dividend reinvestments (DIV), and ACH transfers for portfolio history.
   */
  async getAccountActivities(_userId: string): Promise<Record<string, unknown>[]> {
    throw new Error("TODO: Implement AlpacaService.getAccountActivities");
  }

  /**
   * Export realized gains/losses, wash sales, and dividend reinvestment cost basis as CSV.
   * TODO: Aggregate tax lots from Alpaca activities + LedgerService and format as RFC 4180 CSV.
   */
  async exportTaxLotsCsv(_userId: string, _taxYear: number): Promise<string> {
    throw new Error("TODO: Implement AlpacaService.exportTaxLotsCsv");
  }
}

export const alpacaService = new AlpacaService();
