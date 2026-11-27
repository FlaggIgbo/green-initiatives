import type { EsgBasket, PortfolioPosition } from "@shared/types";

/**
 * Alpaca Trading API Service (Native fetch — zero Alpaca SDK required)
 *
 * Uses ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_BASE_URL (Paper Trading by default).
 * Falls back to simulated paper fills when credentials are not configured.
 */

export const ESG_BASKETS: EsgBasket[] = [
  {
    id: "clean-energy-grid",
    name: "Clean Energy & Grid",
    description: "Solar, clean energy infrastructure, and renewable utilities",
    holdings: [
      { symbol: "ICLN", name: "iShares Global Clean Energy ETF", weight: 0.4 },
      { symbol: "TAN", name: "Invesco Solar ETF", weight: 0.3 },
      { symbol: "NEE", name: "NextEra Energy", weight: 0.3 },
    ],
  },
  {
    id: "broad-esg-core",
    name: "Broad ESG Core",
    description: "Diversified US large-cap ESG screened equities",
    holdings: [
      { symbol: "ESGU", name: "iShares ESG Aware MSCI USA ETF", weight: 0.6 },
      { symbol: "USSG", name: "Xtrackers MSCI USA ESG Leaders ETF", weight: 0.4 },
    ],
  },
  {
    id: "water-circular-economy",
    name: "Water & Circular Economy",
    description: "Water infrastructure and waste/recycling leaders",
    holdings: [
      { symbol: "PHO", name: "Invesco Water Resources ETF", weight: 0.5 },
      { symbol: "WM", name: "Waste Management", weight: 0.5 },
    ],
  },
];

export function getBasketById(basketId: string): EsgBasket {
  return ESG_BASKETS.find((b) => b.id === basketId) ?? ESG_BASKETS[0];
}

export function isAlpacaConfigured(): boolean {
  return Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
}

async function alpacaRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<T> {
  const baseUrl = (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets").replace(
    /\/+$/,
    "",
  );
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "APCA-API-KEY-ID": process.env.ALPACA_API_KEY || "",
      "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY || "",
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || `Alpaca API error (${response.status})`);
  }
  return data;
}

export async function isMarketOpen(): Promise<boolean> {
  if (!isAlpacaConfigured()) return true;
  const clock = await alpacaRequest<{ is_open: boolean }>("/v2/clock");
  return clock.is_open;
}

export async function submitBasketOrders(params: {
  basketId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ orderIds: string[]; status: "INVESTED" | "PENDING_SETTLEMENT" }> {
  const basket = getBasketById(params.basketId);
  const totalUsd = params.amountCents / 100;

  if (!isAlpacaConfigured()) {
    const orderIds = basket.holdings.map(
      (h) => `mock_alpaca_${h.symbol}_${params.idempotencyKey.slice(-6)}`,
    );
    return { orderIds, status: "INVESTED" };
  }

  // TODO: Queue weekend/after-hours flushes and replay at 9:35 AM ET when market opens
  const open = await isMarketOpen();
  if (!open) {
    return { orderIds: [], status: "PENDING_SETTLEMENT" };
  }

  const orderIds: string[] = [];
  for (const holding of basket.holdings) {
    const notional = Number((totalUsd * holding.weight).toFixed(2));
    if (notional < 1) continue; // Alpaca requires >= $1.00 notional for fractional orders
    const order = await alpacaRequest<{ id: string }>("/v2/orders", {
      method: "POST",
      body: {
        symbol: holding.symbol,
        notional: notional.toFixed(2),
        side: "buy",
        type: "market",
        time_in_force: "day",
        client_order_id: `${params.idempotencyKey}_${holding.symbol}`,
      },
    });
    orderIds.push(order.id);
  }

  return { orderIds, status: "INVESTED" };
}

export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  if (!isAlpacaConfigured()) {
    return [
      {
        symbol: "ICLN",
        qty: 1.42,
        avgEntryPrice: 14.1,
        marketValue: 21.3,
        unrealizedPl: 1.28,
        unrealizedPlPct: 6.39,
      },
      {
        symbol: "TAN",
        qty: 0.36,
        avgEntryPrice: 41.2,
        marketValue: 15.84,
        unrealizedPl: 1.01,
        unrealizedPlPct: 6.81,
      },
      {
        symbol: "NEE",
        qty: 0.21,
        avgEntryPrice: 71.5,
        marketValue: 15.75,
        unrealizedPl: 0.74,
        unrealizedPlPct: 4.93,
      },
    ];
  }

  const raw = await alpacaRequest<
    Array<{
      symbol: string;
      qty: string;
      avg_entry_price: string;
      market_value: string;
      unrealized_pl: string;
      unrealized_plpc: string;
    }>
  >("/v2/positions");

  return raw.map((p) => ({
    symbol: p.symbol,
    qty: Number(p.qty),
    avgEntryPrice: Number(p.avg_entry_price),
    marketValue: Number(p.market_value),
    unrealizedPl: Number(p.unrealized_pl),
    unrealizedPlPct: Number((Number(p.unrealized_plpc) * 100).toFixed(2)),
  }));
}
