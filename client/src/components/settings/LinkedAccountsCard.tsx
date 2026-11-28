import type { LinkedAccount } from "@shared/types";

export interface LinkedAccountsCardProps {
  accounts: LinkedAccount[];
  onOpenPlaidLink: () => void;
  onUnlinkAccount: (accountId: string) => void;
}

export function LinkedAccountsCard({
  accounts,
  onOpenPlaidLink,
  onUnlinkAccount,
}: LinkedAccountsCardProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Plaid Linked Bank Accounts</h2>
          <p className="text-xs text-zinc-500">
            Posted card debits are rounded up to the nearest dollar.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenPlaidLink}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Link Bank with Plaid
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500">No bank accounts linked yet.</p>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {acc.institutionName} — {acc.accountName}
                </p>
                <p className="text-xs text-zinc-500">•••• {acc.mask}</p>
              </div>
              <button
                type="button"
                onClick={() => onUnlinkAccount(acc.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Unlink
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
