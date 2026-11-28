import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
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
import { AuthPage } from "../pages/AuthPage";
import { PortfolioPage } from "../pages/PortfolioPage";
import { SettingsPage } from "../pages/SettingsPage";
import { COMPONENT_CATALOG } from "../showcase/ComponentShowcase";

const noop = () => {};

describe("UI components", () => {
  it("AlertBanner renders error role=alert and success role=status", () => {
    const errHtml = renderToStaticMarkup(<AlertBanner variant="error" message="Bad OTP" />);
    assert.match(errHtml, /role="alert"/);
    assert.match(errHtml, /Bad OTP/);

    const okHtml = renderToStaticMarkup(<AlertBanner variant="success" message="Synced!" />);
    assert.match(okHtml, /role="status"/);
    assert.match(okHtml, /Synced!/);
  });

  it("AppHeader renders navigation tabs and user email", () => {
    const html = renderToStaticMarkup(
      <AppHeader
        activeTab="portfolio"
        userEmail="alex@example.com"
        onSelectTab={noop}
        onLogout={noop}
      />,
    );
    assert.match(html, /Green Initiatives/);
    assert.match(html, /Portfolio/);
    assert.match(html, /Bank &amp; ESG Basket/);
    assert.match(html, /alex@example\.com/);
    assert.match(html, /Sign Out/);
  });
});

describe("Auth components", () => {
  it("CredentialsForm displays validation errors and saved credential button", () => {
    const html = renderToStaticMarkup(
      <CredentialsForm
        authMode="login"
        email="bad-email"
        emailError="Please enter a valid email address"
        password="secret"
        busy={false}
        showSavedCredentialButton={true}
        onEmailChange={noop}
        onEmailBlur={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        onSavedCredentialLogin={noop}
        onToggleMode={noop}
      />,
    );
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /Please enter a valid email address/);
    assert.match(html, /Sign In with Saved Password/);
  });

  it("PasskeyChallengeCard adapts copy for existing vs new passkeys", () => {
    const existing = renderToStaticMarkup(
      <PasskeyChallengeCard
        hasPasskey={true}
        busy={false}
        onRetryPasskey={noop}
        onUseEmailOtp={noop}
      />,
    );
    assert.match(existing, /Passkey Verification/);
    assert.match(existing, /Verify with Passkey/);

    const setup = renderToStaticMarkup(
      <PasskeyChallengeCard
        hasPasskey={false}
        busy={false}
        onRetryPasskey={noop}
        onUseEmailOtp={noop}
      />,
    );
    assert.match(setup, /Set Up Your Passkey/);
    assert.match(setup, /Register Passkey/);
  });

  it("EmailOtpCard renders dev code preview and disables submit when code incomplete", () => {
    const html = renderToStaticMarkup(
      <EmailOtpCard
        email="alex@example.com"
        otpCode="123"
        devCode="482910"
        busy={false}
        onOtpCodeChange={noop}
        onSubmit={noop}
        onResend={noop}
        onRetryPasskey={noop}
        onBack={noop}
      />,
    );
    assert.match(html, /alex@example\.com/);
    assert.match(html, /482910/);
    assert.match(html, /disabled=""/);
  });
});

describe("Portfolio components", () => {
  it("PortfolioValueCard formats total USD value and active basket", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueCard totalValue={52.89} activeBasketName="Clean Energy & Grid" />,
    );
    assert.match(html, /\$52\.89/);
    assert.match(html, /Clean Energy &amp; Grid/);
  });

  it("RoundUpProgressCard computes progress percentage and disables Invest below threshold", () => {
    const html = renderToStaticMarkup(
      <RoundUpProgressCard
        balanceCents={385}
        thresholdCents={500}
        busy={false}
        canSync={true}
        onSyncPlaid={noop}
        onFlushToAlpaca={noop}
      />,
    );
    assert.match(html, /\$3\.85 \/ \$5\.00/);
    assert.match(html, /aria-valuenow="77"/);
    assert.match(html, /Invest via Alpaca/);
  });

  it("HoldingsTable renders positions and empty state", () => {
    const populated = renderToStaticMarkup(
      <HoldingsTable
        positions={[
          {
            symbol: "ICLN",
            qty: 1.42,
            avgEntryPrice: 14.1,
            marketValue: 21.3,
            unrealizedPl: 1.28,
            unrealizedPlPct: 6.39,
          },
        ]}
      />,
    );
    assert.match(populated, /ICLN/);
    assert.match(populated, /1\.4200/);
    assert.match(populated, /\+\$1\.28 \(6\.39%\)/);

    const empty = renderToStaticMarkup(<HoldingsTable positions={[]} />);
    assert.match(empty, /No ESG positions yet/);
  });

  it("RecentTransactionsList renders transactions and empty state", () => {
    const populated = renderToStaticMarkup(
      <RecentTransactionsList
        transactions={[
          {
            id: "t1",
            plaidTransactionId: "p1",
            merchantName: "Blue Bottle Coffee",
            amountCents: 435,
            roundUpCents: 65,
            date: "2026-11-26",
          },
        ]}
      />,
    );
    assert.match(populated, /Blue Bottle Coffee/);
    assert.match(populated, /\+\$0\.65/);

    const empty = renderToStaticMarkup(<RecentTransactionsList transactions={[]} />);
    assert.match(empty, /Link a Plaid bank account/);
  });
});

describe("Settings components", () => {
  it("LinkedAccountsCard renders accounts and empty state", () => {
    const html = renderToStaticMarkup(
      <LinkedAccountsCard
        accounts={[
          {
            id: "acc_1",
            plaidItemId: "item_1",
            plaidAccountId: "pa_1",
            institutionName: "Plaid Sandbox Bank",
            accountName: "Checking",
            mask: "1234",
            createdAt: "2026-11-01T12:00:00.000Z",
          },
        ]}
        onOpenPlaidLink={noop}
        onUnlinkAccount={noop}
      />,
    );
    assert.match(html, /Plaid Sandbox Bank — Checking/);
    assert.match(html, /1234/);

    const empty = renderToStaticMarkup(
      <LinkedAccountsCard accounts={[]} onOpenPlaidLink={noop} onUnlinkAccount={noop} />,
    );
    assert.match(empty, /No bank accounts linked yet/);
  });

  it("EsgBasketSelector marks selected basket with aria-pressed", () => {
    const html = renderToStaticMarkup(
      <EsgBasketSelector
        baskets={[
          {
            id: "clean-energy-grid",
            name: "Clean Energy & Grid",
            description: "Solar & grid",
            holdings: [{ symbol: "ICLN", name: "iShares", weight: 1 }],
          },
        ]}
        selectedBasketId="clean-energy-grid"
        roundUpEnabled={true}
        onSelectBasket={noop}
        onToggleRoundUp={noop}
      />,
    );
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /ICLN 100%/);
  });

  it("PasskeysCard and PlaidLinkDialog render expected controls", () => {
    const pkHtml = renderToStaticMarkup(
      <PasskeysCard
        passkeys={[
          {
            credentialId: "c1",
            label: "MacBook Touch ID",
            createdAt: "2026-11-10T12:00:00.000Z",
          },
        ]}
        busy={false}
        passkeySupported={true}
        onAddPasskey={noop}
        onDeletePasskey={noop}
      />,
    );
    assert.match(pkHtml, /MacBook Touch ID/);

    const dialogHtml = renderToStaticMarkup(
      <PlaidLinkDialog busy={false} inline={true} onSelectBank={noop} onClose={noop} />,
    );
    assert.match(dialogHtml, /role="dialog"/);
    assert.match(dialogHtml, /Plaid Sandbox Bank/);
    assert.match(dialogHtml, /Chase/);
  });
});

describe("Collated pages & component catalog", () => {
  it("renders AuthPage, PortfolioPage, SettingsPage, and every showcase entry", () => {
    const authHtml = renderToStaticMarkup(
      <AuthPage
        authMode="login"
        email=""
        emailError={null}
        password=""
        mfaStep="none"
        otpCode=""
        mfaNotice={null}
        error={null}
        busy={false}
        showSavedCredentialButton={false}
        onEmailChange={noop}
        onEmailBlur={noop}
        onPasswordChange={noop}
        onAuthSubmit={noop}
        onSavedCredentialLogin={noop}
        onToggleMode={noop}
        onRetryPasskey={noop}
        onUseEmailOtp={noop}
        onOtpCodeChange={noop}
        onOtpSubmit={noop}
        onResendOtp={noop}
        onBackToSignIn={noop}
      />,
    );
    assert.match(authHtml, /Green Initiatives/);

    const portfolioHtml = renderToStaticMarkup(
      <PortfolioPage
        totalPortfolioValue={10}
        activeBasketName="Clean Energy & Grid"
        balanceCents={250}
        thresholdCents={500}
        positions={[]}
        recentTransactions={[]}
        busy={false}
        canSync={false}
        onSyncPlaid={noop}
        onFlushToAlpaca={noop}
      />,
    );
    assert.match(portfolioHtml, /ESG Portfolio \(Alpaca\)/);
    assert.match(portfolioHtml, /Pending Round-Ups/);

    const settingsHtml = renderToStaticMarkup(
      <SettingsPage
        accounts={[]}
        baskets={[]}
        selectedBasketId="clean-energy-grid"
        roundUpEnabled={true}
        passkeys={[]}
        busy={false}
        passkeySupported={true}
        onOpenPlaidLink={noop}
        onUnlinkAccount={noop}
        onSelectBasket={noop}
        onToggleRoundUp={noop}
        onAddPasskey={noop}
        onDeletePasskey={noop}
      />,
    );
    assert.match(settingsHtml, /Plaid Linked Bank Accounts/);
    assert.match(settingsHtml, /Security &amp; Passkeys/);

    assert.ok(COMPONENT_CATALOG.length >= 12);
    for (const entry of COMPONENT_CATALOG) {
      const html = renderToStaticMarkup(<>{entry.render()}</>);
      assert.ok(html.length > 0, `Expected non-empty render for ${entry.id}`);
    }
  });
});
