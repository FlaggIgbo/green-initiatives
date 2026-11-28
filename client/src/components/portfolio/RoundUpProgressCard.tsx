import { formatUsd } from "../../utils/format";

export interface RoundUpProgressCardProps {
  balanceCents: number;
  thresholdCents: number;
  busy: boolean;
  canSync: boolean;
  onSyncPlaid: () => void;
  onFlushToAlpaca: () => void;
}

export function RoundUpProgressCard({
  balanceCents,
  thresholdCents,
  busy,
  canSync,
  onSyncPlaid,
  onFlushToAlpaca,
}: RoundUpProgressCardProps) {
  const progressPct = Math.min(100, Math.round((balanceCents / thresholdCents) * 100));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pending Round-Ups
        </p>
        <span className="text-xs text-zinc-500">
          {formatUsd(balanceCents / 100)} / {formatUsd(thresholdCents / 100)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Pending round-ups progress"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100"
      >
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !canSync}
          onClick={onSyncPlaid}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Sync Plaid Transactions
        </button>
        <button
          type="button"
          disabled={busy || balanceCents < thresholdCents}
          onClick={onFlushToAlpaca}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Invest via Alpaca
        </button>
      </div>
    </div>
  );
}
