import type { EsgBasket } from "@shared/types";

export interface EsgBasketSelectorProps {
  baskets: EsgBasket[];
  selectedBasketId: string;
  roundUpEnabled: boolean;
  onSelectBasket: (basketId: string) => void;
  onToggleRoundUp: () => void;
}

export function EsgBasketSelector({
  baskets,
  selectedBasketId,
  roundUpEnabled,
  onSelectBasket,
  onToggleRoundUp,
}: EsgBasketSelectorProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">ESG Portfolio Basket (Alpaca)</h2>
          <p className="text-xs text-zinc-500">
            Choose which fractional ETF sleeve receives your $5+ round-up flushes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={roundUpEnabled}
            onChange={onToggleRoundUp}
            className="h-4 w-4 accent-emerald-600"
          />
          Auto Round-Ups
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {baskets.map((basket) => {
          const selected = selectedBasketId === basket.id;
          return (
            <button
              key={basket.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectBasket(basket.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-emerald-600 bg-emerald-50/50"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <p className="text-sm font-semibold">{basket.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{basket.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {basket.holdings.map((h) => (
                  <span
                    key={h.symbol}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700"
                  >
                    {h.symbol} {Math.round(h.weight * 100)}%
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
