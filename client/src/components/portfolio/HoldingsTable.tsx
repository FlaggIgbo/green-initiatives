import type { PortfolioPosition } from "@shared/types";
import { formatUsd } from "../../utils/format";

export interface HoldingsTableProps {
  positions: PortfolioPosition[];
}

export function HoldingsTable({ positions }: HoldingsTableProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Alpaca ESG Holdings</h2>
      {positions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No ESG positions yet. Accumulate $5.00 in round-ups to submit your first fractional order.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500">
              <tr>
                <th className="py-2">Symbol</th>
                <th className="py-2">Shares</th>
                <th className="py-2">Avg Cost</th>
                <th className="py-2">Market Value</th>
                <th className="py-2 text-right">Unrealized P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {positions.map((pos) => (
                <tr key={pos.symbol}>
                  <td className="py-2.5 font-semibold">{pos.symbol}</td>
                  <td className="py-2.5">{pos.qty.toFixed(4)}</td>
                  <td className="py-2.5">{formatUsd(pos.avgEntryPrice)}</td>
                  <td className="py-2.5">{formatUsd(pos.marketValue)}</td>
                  <td
                    className={`py-2.5 text-right font-medium ${
                      pos.unrealizedPl >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {pos.unrealizedPl >= 0 ? "+" : ""}
                    {formatUsd(pos.unrealizedPl)} ({pos.unrealizedPlPct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
