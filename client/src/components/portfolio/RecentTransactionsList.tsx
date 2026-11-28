import type { RoundUpTransaction } from "@shared/types";
import { formatUsd } from "../../utils/format";

export interface RecentTransactionsListProps {
  transactions: RoundUpTransaction[];
}

export function RecentTransactionsList({ transactions }: RecentTransactionsListProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Recent Plaid Round-Ups</h2>
      {transactions.length > 0 ? (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-medium">{t.merchantName}</p>
                <p className="text-xs text-zinc-500">
                  {t.date} • Spent {formatUsd(t.amountCents / 100)}
                </p>
              </div>
              <span className="font-semibold text-emerald-700">
                +{formatUsd(t.roundUpCents / 100)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          Link a Plaid bank account and sync transactions to start accruing spare change.
        </p>
      )}
    </section>
  );
}
