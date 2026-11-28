import { formatUsd } from "../../utils/format";

export interface PortfolioValueCardProps {
  totalValue: number;
  activeBasketName: string;
}

export function PortfolioValueCard({ totalValue, activeBasketName }: PortfolioValueCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        ESG Portfolio (Alpaca)
      </p>
      <p className="mt-1 text-3xl font-bold">{formatUsd(totalValue)}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Active basket: <span className="font-medium text-zinc-800">{activeBasketName}</span>
      </p>
    </div>
  );
}
