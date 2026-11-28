import type { ReactNode } from "react";
import type {
  EsgBasket,
  LinkedAccount,
  PasskeySummary,
  PortfolioPosition,
  RoundUpTransaction,
} from "@shared/types";
import { AlertBanner } from "../components/ui/AlertBanner";
import { AppHeader } from "../components/ui/AppHeader";
import { CredentialsForm } from "../components/auth/CredentialsForm";
import { PasskeyChallengeCard } from "../components/auth/PasskeyChallengeCard";
import { EmailOtpCard } from "../components/auth/EmailOtpCard";
import { PortfolioValueCard } from "../components/portfolio/PortfolioValueCard";
import { RoundUpProgressCard } from "../components/portfolio/RoundUpProgressCard";
import { HoldingsTable } from "../components/portfolio/HoldingsTable";
import { RecentTransactionsList } from "../components/portfolio/RecentTransactionsList";
import { LinkedAccountsCard } from "../components/settings/LinkedAccountsCard";
import { EsgBasketSelector } from "../components/settings/EsgBasketSelector";
import { PasskeysCard } from "../components/settings/PasskeysCard";
import { PlaidLinkDialog } from "../components/settings/PlaidLinkDialog";

const noop = () => {};

const MOCK_BASKETS: EsgBasket[] = [
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

const MOCK_POSITIONS: PortfolioPosition[] = [
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

const MOCK_TRANSACTIONS: RoundUpTransaction[] = [
  {
    id: "t1",
    plaidTransactionId: "plaid_1",
    merchantName: "Blue Bottle Coffee",
    amountCents: 435,
    roundUpCents: 65,
    date: "2026-11-26",
  },
  {
    id: "t2",
    plaidTransactionId: "plaid_2",
    merchantName: "Trader Joe's",
    amountCents: 2840,
    roundUpCents: 60,
    date: "2026-11-25",
  },
];

const MOCK_ACCOUNTS: LinkedAccount[] = [
  {
    id: "acc_1",
    plaidItemId: "item_1",
    plaidAccountId: "acc_plaid_1",
    institutionName: "Plaid Sandbox Bank",
    accountName: "Checking",
    mask: "1234",
    createdAt: "2026-11-01T12:00:00.000Z",
  },
];

const MOCK_PASSKEYS: PasskeySummary[] = [
  {
    credentialId: "cred_mock_1",
    label: "MacBook Touch ID",
    createdAt: "2026-11-10T12:00:00.000Z",
    lastUsedAt: "2026-11-27T14:00:00.000Z",
  },
];

export interface ShowcaseEntry {
  id: string;
  title: string;
  category: "UI" | "Auth" | "Portfolio" | "Settings";
  widthClass: string;
  render: () => ReactNode;
}

export const COMPONENT_CATALOG: ShowcaseEntry[] = [
  {
    id: "alert-banner",
    title: "AlertBanner",
    category: "UI",
    widthClass: "w-full max-w-xl",
    render: () => (
      <div className="space-y-3">
        <AlertBanner
          variant="success"
          message="Submitted $5.15 to Alpaca (INVESTED, 3 order(s))."
        />
        <AlertBanner
          variant="warning"
          message="Passkey unavailable on this device. Falling back to Email OTP verification."
          compact
        />
        <AlertBanner variant="error" message="Invalid verification code. Please try again." />
      </div>
    ),
  },
  {
    id: "app-header",
    title: "AppHeader",
    category: "UI",
    widthClass: "w-full max-w-4xl",
    render: () => (
      <AppHeader
        activeTab="portfolio"
        userEmail="alex@example.com"
        onSelectTab={noop}
        onLogout={noop}
      />
    ),
  },
  {
    id: "credentials-form",
    title: "CredentialsForm",
    category: "Auth",
    widthClass: "w-full max-w-sm",
    render: () => (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <CredentialsForm
          authMode="login"
          email="alex@example.com"
          emailError={null}
          password="••••••••"
          busy={false}
          showSavedCredentialButton={true}
          onEmailChange={noop}
          onEmailBlur={noop}
          onPasswordChange={noop}
          onSubmit={(e) => e.preventDefault()}
          onSavedCredentialLogin={noop}
          onToggleMode={noop}
        />
      </div>
    ),
  },
  {
    id: "passkey-challenge-card",
    title: "PasskeyChallengeCard",
    category: "Auth",
    widthClass: "w-full max-w-sm",
    render: () => (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <PasskeyChallengeCard
          hasPasskey={true}
          busy={false}
          onRetryPasskey={noop}
          onUseEmailOtp={noop}
        />
      </div>
    ),
  },
  {
    id: "email-otp-card",
    title: "EmailOtpCard",
    category: "Auth",
    widthClass: "w-full max-w-sm",
    render: () => (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <EmailOtpCard
          email="alex@example.com"
          otpCode="482910"
          devCode="482910"
          busy={false}
          onOtpCodeChange={noop}
          onSubmit={(e) => e.preventDefault()}
          onResend={noop}
          onRetryPasskey={noop}
          onBack={noop}
        />
      </div>
    ),
  },
  {
    id: "portfolio-value-card",
    title: "PortfolioValueCard",
    category: "Portfolio",
    widthClass: "w-full max-w-md",
    render: () => <PortfolioValueCard totalValue={52.89} activeBasketName="Clean Energy & Grid" />,
  },
  {
    id: "roundup-progress-card",
    title: "RoundUpProgressCard",
    category: "Portfolio",
    widthClass: "w-full max-w-md",
    render: () => (
      <RoundUpProgressCard
        balanceCents={385}
        thresholdCents={500}
        busy={false}
        canSync={true}
        onSyncPlaid={noop}
        onFlushToAlpaca={noop}
      />
    ),
  },
  {
    id: "holdings-table",
    title: "HoldingsTable",
    category: "Portfolio",
    widthClass: "w-full max-w-3xl",
    render: () => <HoldingsTable positions={MOCK_POSITIONS} />,
  },
  {
    id: "recent-transactions-list",
    title: "RecentTransactionsList",
    category: "Portfolio",
    widthClass: "w-full max-w-3xl",
    render: () => <RecentTransactionsList transactions={MOCK_TRANSACTIONS} />,
  },
  {
    id: "linked-accounts-card",
    title: "LinkedAccountsCard",
    category: "Settings",
    widthClass: "w-full max-w-3xl",
    render: () => (
      <LinkedAccountsCard accounts={MOCK_ACCOUNTS} onOpenPlaidLink={noop} onUnlinkAccount={noop} />
    ),
  },
  {
    id: "esg-basket-selector",
    title: "EsgBasketSelector",
    category: "Settings",
    widthClass: "w-full max-w-3xl",
    render: () => (
      <EsgBasketSelector
        baskets={MOCK_BASKETS}
        selectedBasketId="clean-energy-grid"
        roundUpEnabled={true}
        onSelectBasket={noop}
        onToggleRoundUp={noop}
      />
    ),
  },
  {
    id: "passkeys-card",
    title: "PasskeysCard",
    category: "Settings",
    widthClass: "w-full max-w-3xl",
    render: () => (
      <PasskeysCard
        passkeys={MOCK_PASSKEYS}
        busy={false}
        passkeySupported={true}
        onAddPasskey={noop}
        onDeletePasskey={noop}
      />
    ),
  },
  {
    id: "plaid-link-dialog",
    title: "PlaidLinkDialog",
    category: "Settings",
    widthClass: "w-full max-w-sm",
    render: () => <PlaidLinkDialog busy={false} inline={true} onSelectBank={noop} onClose={noop} />,
  },
];

export interface ComponentShowcaseProps {
  componentId?: string | null;
}

export function ComponentShowcase({ componentId }: ComponentShowcaseProps) {
  if (componentId) {
    const entry = COMPONENT_CATALOG.find((item) => item.id === componentId);
    if (!entry) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
            Unknown component: <code>{componentId}</code>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
        <div data-testid="component-preview" className={entry.widthClass}>
          {entry.render()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Green Initiatives Component Gallery</h1>
            <p className="text-xs text-zinc-500">
              {COMPONENT_CATALOG.length} isolated components collated into Auth, Portfolio, and
              Settings pages.
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Back to App
          </a>
        </header>

        <div className="space-y-8">
          {COMPONENT_CATALOG.map((entry) => (
            <section key={entry.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {entry.category}
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-800">{entry.title}</h2>
                </div>
                <a
                  href={`/?component=${entry.id}`}
                  className="text-xs text-emerald-700 hover:underline"
                >
                  Open isolated →
                </a>
              </div>
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/60 p-6">
                <div className={entry.widthClass}>{entry.render()}</div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
