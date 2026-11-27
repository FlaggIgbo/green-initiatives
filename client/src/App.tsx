import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import type {
  EsgBasket,
  LinkedAccount,
  PortfolioPosition,
  PublicUser,
  RoundUpSummary,
} from "@shared/types";

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"portfolio" | "settings">("portfolio");

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // App data
  const [baskets, setBaskets] = useState<EsgBasket[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [summary, setSummary] = useState<RoundUpSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [busy, setBusy] = useState(false);

  // Simulated Plaid Link modal (TODO: swap for Plaid Link SDK when live)
  const [plaidOpen, setPlaidOpen] = useState(false);

  const loadAppData = async () => {
    const [b, a, s, p] = await Promise.all([
      api.getBaskets(),
      api.getAccounts(),
      api.getSummary(),
      api.getPositions(),
    ]);
    setBaskets(b);
    setAccounts(a);
    setSummary(s);
    setPositions(p);
  };

  useEffect(() => {
    api
      .getMe()
      .then(async ({ user: u }) => {
        setUser(u);
        await loadAppData();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res =
        authMode === "login"
          ? await api.login(email, password)
          : await api.register(email, password);
      setUser(res.user);
      await loadAppData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSummary(null);
    setAccounts([]);
    setPositions([]);
  };

  const handleLinkPlaidBank = async (
    institutionName: string,
    accountName: string,
    mask: string,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await api.exchangePlaidToken({
        publicToken: `public-sandbox-${Date.now()}`,
        institutionName,
        accountName,
        mask,
      });
      setPlaidOpen(false);
      await loadAppData();
      setMessage(`Linked ${institutionName} (${accountName} •••• ${mask}) via Plaid.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link bank");
    } finally {
      setBusy(false);
    }
  };

  const handleSyncPlaid = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.syncPlaid();
      await loadAppData();
      setMessage(
        `Synced ${res.addedCount} Plaid transaction(s) (+${formatUsd(res.accruedCents / 100)} accrued).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plaid sync failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFlushToAlpaca = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.flushRoundUps();
      await loadAppData();
      if (res.investedCents > 0) {
        setMessage(
          `Submitted ${formatUsd(res.investedCents / 100)} to Alpaca (${res.status}, ${res.orderIds.length} order(s)).`,
        );
      } else {
        setMessage("Balance is below the $5.00 investment threshold.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alpaca flush failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectBasket = async (selectedBasketId: string) => {
    const res = await api.updateSettings({ selectedBasketId });
    setUser(res.user);
    await loadAppData();
  };

  const handleToggleRoundUp = async () => {
    if (!user) return;
    const res = await api.updateSettings({ roundUpEnabled: !user.roundUpEnabled });
    setUser(res.user);
    await loadAppData();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Plaid + Alpaca
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Green Initiatives</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Round up spare change into fractional ESG ETFs.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-800"
          >
            {authMode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  const balanceCents = summary?.balanceCents ?? 0;
  const thresholdCents = summary?.thresholdCents ?? 500;
  const progressPct = Math.min(100, Math.round((balanceCents / thresholdCents) * 100));
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-emerald-700">Green Initiatives</span>
            <nav className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab("portfolio")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === "portfolio"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Portfolio
              </button>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === "settings"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Bank &amp; ESG Basket
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "portfolio" ? (
          <>
            {/* Round-Up Threshold & Actions */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  ESG Portfolio (Alpaca)
                </p>
                <p className="mt-1 text-3xl font-bold">{formatUsd(totalPortfolioValue)}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Active basket:{" "}
                  <span className="font-medium text-zinc-800">
                    {baskets.find((b) => b.id === user.selectedBasketId)?.name ??
                      user.selectedBasketId}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Pending Round-Ups
                  </p>
                  <span className="text-xs text-zinc-500">
                    {formatUsd(balanceCents / 100)} / {formatUsd(thresholdCents / 100)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || accounts.length === 0}
                    onClick={handleSyncPlaid}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Sync Plaid Transactions
                  </button>
                  <button
                    type="button"
                    disabled={busy || balanceCents < thresholdCents}
                    onClick={handleFlushToAlpaca}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Invest via Alpaca
                  </button>
                </div>
              </div>
            </section>

            {/* Positions Table */}
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Alpaca ESG Holdings</h2>
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
            </section>

            {/* Recent Plaid Round-Up Transactions */}
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Recent Plaid Round-Ups</h2>
              {summary?.recentTransactions.length ? (
                <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                  {summary.recentTransactions.map((t) => (
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
          </>
        ) : (
          <>
            {/* Linked Plaid Accounts */}
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
                  onClick={() => setPlaidOpen(true)}
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
                        onClick={async () => {
                          await api.unlinkAccount(acc.id);
                          await loadAppData();
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Unlink
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ESG Basket Selection */}
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
                    checked={user.roundUpEnabled}
                    onChange={handleToggleRoundUp}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Auto Round-Ups
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {baskets.map((basket) => {
                  const selected = user.selectedBasketId === basket.id;
                  return (
                    <button
                      key={basket.id}
                      type="button"
                      onClick={() => handleSelectBasket(basket.id)}
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
          </>
        )}
      </main>

      {/* Plaid Link Sandbox Dialog */}
      {plaidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-label="Plaid Link"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Plaid Link (Sandbox)</h3>
              <button
                type="button"
                onClick={() => setPlaidOpen(false)}
                className="text-sm text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Select a sandbox bank account to connect for spare-change round-ups.
            </p>
            <div className="mt-4 space-y-2">
              {[
                { institution: "Plaid Sandbox Bank", account: "Checking", mask: "1234" },
                { institution: "Chase", account: "Total Checking", mask: "4421" },
              ].map((item) => (
                <button
                  key={item.mask}
                  type="button"
                  disabled={busy}
                  onClick={() => handleLinkPlaidBank(item.institution, item.account, item.mask)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left text-sm hover:border-emerald-500 hover:bg-emerald-50/40"
                >
                  <div>
                    <p className="font-semibold">{item.institution}</p>
                    <p className="text-xs text-zinc-500">
                      {item.account} •••• {item.mask}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-700">Connect</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
