export type AppTab = "portfolio" | "settings";

export interface AppHeaderProps {
  activeTab: AppTab;
  userEmail: string;
  onSelectTab: (tab: AppTab) => void;
  onLogout: () => void;
}

export function AppHeader({ activeTab, userEmail, onSelectTab, onLogout }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-bold text-emerald-700">Green Initiatives</span>
          <nav className="flex gap-2" aria-label="Primary">
            <button
              type="button"
              onClick={() => onSelectTab("portfolio")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "portfolio"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("settings")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === "settings"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Bank &amp; ESG Basket
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-zinc-500 sm:inline">{userEmail}</span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
