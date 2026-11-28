import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import {
  authenticateWithPasskey,
  createPasskey,
  getStoredPasswordCredential,
  isPasskeySupported,
  isPasswordCredentialSupported,
  preventSilentCredentialAccess,
  storePasswordCredential,
} from "./credentials";
import { formatUsd, validateEmail } from "./utils/format";
import { AlertBanner } from "./components/ui/AlertBanner";
import { AppHeader, type AppTab } from "./components/ui/AppHeader";
import { PlaidLinkDialog } from "./components/settings/PlaidLinkDialog";
import { AuthPage } from "./pages/AuthPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { SettingsPage } from "./pages/SettingsPage";
import type {
  AuthStepResponse,
  EsgBasket,
  LinkedAccount,
  PasskeySummary,
  PortfolioPosition,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  PublicUser,
  RoundUpSummary,
} from "@shared/types";

interface PendingMfaState {
  mfaToken: string;
  email: string;
  password: string;
  hasPasskey: boolean;
  passkeyOptions?: PublicKeyCredentialRequestOptionsJSON;
  passkeyRegistrationOptions?: PublicKeyCredentialCreationOptionsJSON;
}

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AppTab>("portfolio");

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [mfaStep, setMfaStep] = useState<"none" | "passkey" | "otp">("none");
  const [pendingMfa, setPendingMfa] = useState<PendingMfaState | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpInfo, setOtpInfo] = useState<{ delivery: "smtp" | "console"; devCode?: string } | null>(
    null,
  );
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // App data
  const [baskets, setBaskets] = useState<EsgBasket[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [summary, setSummary] = useState<RoundUpSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [busy, setBusy] = useState(false);

  // Simulated Plaid Link modal (TODO: swap for Plaid Link SDK when live)
  const [plaidOpen, setPlaidOpen] = useState(false);

  const loadAppData = async () => {
    const [b, a, s, p, pk] = await Promise.all([
      api.getBaskets(),
      api.getAccounts(),
      api.getSummary(),
      api.getPositions(),
      api.getPasskeys().catch(() => [] as PasskeySummary[]),
    ]);
    setBaskets(b);
    setAccounts(a);
    setSummary(s);
    setPositions(p);
    setPasskeys(pk);
  };

  const completeSignIn = async (
    authedUser: PublicUser,
    credEmail?: string,
    credPassword?: string,
  ) => {
    if (credEmail && credPassword) {
      await storePasswordCredential(credEmail, credPassword);
    }
    setPendingMfa(null);
    setMfaStep("none");
    setOtpCode("");
    setOtpInfo(null);
    setMfaNotice(null);
    setUser(authedUser);
    await loadAppData();
  };

  const triggerEmailOtpFallback = async (mfa: PendingMfaState, reason?: string) => {
    setMfaStep("otp");
    setError(null);
    setMfaNotice(
      reason
        ? `${reason} Falling back to Email OTP verification.`
        : "Verify with a 6-digit code sent to your email.",
    );
    setAuthBusy(true);
    try {
      const otpRes = await api.sendEmailOtp(mfa.mfaToken);
      setOtpInfo({ delivery: otpRes.delivery, devCode: otpRes.devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send Email OTP");
    } finally {
      setAuthBusy(false);
    }
  };

  const runPasskeyChallenge = async (mfa: PendingMfaState) => {
    setMfaStep("passkey");
    setError(null);
    setMfaNotice(null);

    if (!isPasskeySupported()) {
      await triggerEmailOtpFallback(mfa, "Passkeys are not supported on this browser.");
      return;
    }

    setAuthBusy(true);
    try {
      if (mfa.hasPasskey && mfa.passkeyOptions) {
        const assertion = await authenticateWithPasskey(mfa.passkeyOptions);
        const verified = await api.verifyPasskeyLogin(assertion, mfa.mfaToken);
        await completeSignIn(verified.user, mfa.email, mfa.password);
        return;
      }

      if (!mfa.hasPasskey && mfa.passkeyRegistrationOptions) {
        const registration = await createPasskey(mfa.passkeyRegistrationOptions);
        const verified = await api.verifyPasskeyRegistration(registration, mfa.mfaToken);
        await completeSignIn(verified.user, mfa.email, mfa.password);
        return;
      }

      await triggerEmailOtpFallback(mfa, "Passkey challenge options unavailable.");
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : "Passkey verification could not be completed.";
      await triggerEmailOtpFallback(mfa, `Passkey unavailable (${reason}).`);
    } finally {
      setAuthBusy(false);
    }
  };

  const submitCredentials = async (
    targetEmail: string,
    targetPassword: string,
    mode: "login" | "register",
  ) => {
    setError(null);
    setMessage(null);
    setAuthBusy(true);
    try {
      const res: AuthStepResponse =
        mode === "login"
          ? await api.login(targetEmail, targetPassword)
          : await api.register(targetEmail, targetPassword);

      if (res.status === "authenticated" || ("user" in res && res.user)) {
        const authedUser = (res as { user: PublicUser }).user;
        await completeSignIn(authedUser, targetEmail, targetPassword);
        return;
      }

      const mfa: PendingMfaState = {
        mfaToken: res.mfaToken,
        email: res.email,
        password: targetPassword,
        hasPasskey: res.hasPasskey,
        passkeyOptions: res.passkeyOptions,
        passkeyRegistrationOptions: res.passkeyRegistrationOptions,
      };
      setPendingMfa(mfa);
      await runPasskeyChallenge(mfa);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    api
      .getMe()
      .then(async ({ user: u }) => {
        setUser(u);
        await loadAppData();
      })
      .catch(async () => {
        setUser(null);
        const stored = await getStoredPasswordCredential("silent");
        if (stored) {
          setEmail(stored.email);
          setPassword(stored.password);
          await submitCredentials(stored.email, stored.password, "login");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    setEmailError(validationError);
    if (validationError) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    await submitCredentials(email.trim(), password, authMode);
  };

  const handleSavedCredentialLogin = async () => {
    setError(null);
    const stored = await getStoredPasswordCredential("optional");
    if (!stored) {
      setError("No saved password credentials found in your browser.");
      return;
    }
    setEmail(stored.email);
    setPassword(stored.password);
    await submitCredentials(stored.email, stored.password, "login");
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingMfa) return;
    setError(null);
    setAuthBusy(true);
    try {
      const verified = await api.verifyEmailOtp(pendingMfa.mfaToken, otpCode);
      await completeSignIn(verified.user, pendingMfa.email, pendingMfa.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRetryPasskey = async () => {
    if (!pendingMfa) return;
    setError(null);
    setAuthBusy(true);
    try {
      if (pendingMfa.hasPasskey) {
        const { options } = await api.getPasskeyLoginOptions(pendingMfa.mfaToken);
        const updated: PendingMfaState = { ...pendingMfa, passkeyOptions: options };
        setPendingMfa(updated);
        await runPasskeyChallenge(updated);
      } else {
        const { options } = await api.getPasskeyRegisterOptions(pendingMfa.mfaToken);
        const updated: PendingMfaState = { ...pendingMfa, passkeyRegistrationOptions: options };
        setPendingMfa(updated);
        await runPasskeyChallenge(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restart passkey verification");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegisterNewPasskey = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { options } = await api.getPasskeyRegisterOptions();
      const registration = await createPasskey(
        options,
        `Passkey (${new Date().toLocaleDateString()})`,
      );
      await api.verifyPasskeyRegistration(registration);
      await loadAppData();
      setMessage("New passkey registered for your account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register passkey");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    await preventSilentCredentialAccess();
    setUser(null);
    setSummary(null);
    setAccounts([]);
    setPositions([]);
    setPasskeys([]);
    setPendingMfa(null);
    setMfaStep("none");
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

  const handleUnlinkAccount = async (accountId: string) => {
    await api.unlinkAccount(accountId);
    await loadAppData();
  };

  const handleDeletePasskey = async (credentialId: string) => {
    await api.deletePasskey(credentialId);
    await loadAppData();
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
      <AuthPage
        authMode={authMode}
        email={email}
        emailError={emailError}
        password={password}
        mfaStep={mfaStep}
        mfaEmail={pendingMfa?.email}
        hasPasskey={pendingMfa?.hasPasskey}
        otpCode={otpCode}
        otpDevCode={otpInfo?.devCode}
        mfaNotice={mfaNotice}
        error={error}
        busy={authBusy}
        showSavedCredentialButton={isPasswordCredentialSupported()}
        onEmailChange={(next) => {
          setEmail(next);
          if (emailError) setEmailError(validateEmail(next));
        }}
        onEmailBlur={() => {
          if (email.length > 0) setEmailError(validateEmail(email));
        }}
        onPasswordChange={setPassword}
        onAuthSubmit={handleAuthSubmit}
        onSavedCredentialLogin={handleSavedCredentialLogin}
        onToggleMode={() => {
          setError(null);
          setAuthMode(authMode === "login" ? "register" : "login");
        }}
        onRetryPasskey={handleRetryPasskey}
        onUseEmailOtp={() => {
          if (pendingMfa) void triggerEmailOtpFallback(pendingMfa);
        }}
        onOtpCodeChange={setOtpCode}
        onOtpSubmit={handleOtpSubmit}
        onResendOtp={() => {
          if (pendingMfa) void triggerEmailOtpFallback(pendingMfa);
        }}
        onBackToSignIn={() => {
          setMfaStep("none");
          setPendingMfa(null);
          setOtpCode("");
          setOtpInfo(null);
          setMfaNotice(null);
          setError(null);
        }}
      />
    );
  }

  const balanceCents = summary?.balanceCents ?? 0;
  const thresholdCents = summary?.thresholdCents ?? 500;
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const activeBasketName =
    baskets.find((b) => b.id === user.selectedBasketId)?.name ?? user.selectedBasketId;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppHeader
        activeTab={tab}
        userEmail={user.email}
        onSelectTab={setTab}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {message && <AlertBanner variant="success" message={message} />}
        {error && <AlertBanner variant="error" message={error} />}

        {tab === "portfolio" ? (
          <PortfolioPage
            totalPortfolioValue={totalPortfolioValue}
            activeBasketName={activeBasketName}
            balanceCents={balanceCents}
            thresholdCents={thresholdCents}
            positions={positions}
            recentTransactions={summary?.recentTransactions ?? []}
            busy={busy}
            canSync={accounts.length > 0}
            onSyncPlaid={handleSyncPlaid}
            onFlushToAlpaca={handleFlushToAlpaca}
          />
        ) : (
          <SettingsPage
            accounts={accounts}
            baskets={baskets}
            selectedBasketId={user.selectedBasketId}
            roundUpEnabled={user.roundUpEnabled}
            passkeys={passkeys}
            busy={busy}
            passkeySupported={isPasskeySupported()}
            onOpenPlaidLink={() => setPlaidOpen(true)}
            onUnlinkAccount={handleUnlinkAccount}
            onSelectBasket={handleSelectBasket}
            onToggleRoundUp={handleToggleRoundUp}
            onAddPasskey={handleRegisterNewPasskey}
            onDeletePasskey={handleDeletePasskey}
          />
        )}
      </main>

      {plaidOpen && (
        <PlaidLinkDialog
          busy={busy}
          onSelectBank={handleLinkPlaidBank}
          onClose={() => setPlaidOpen(false)}
        />
      )}
    </div>
  );
}
