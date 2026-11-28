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

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Please enter a valid email address (e.g. you@example.com).";
  }
  return null;
}

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
  const [tab, setTab] = useState<"portfolio" | "settings">("portfolio");

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
        // Attempt silent sign-in via navigator.credentials.get({ password: true })
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
      const registration = await createPasskey(options, `Passkey (${new Date().toLocaleDateString()})`);
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

          {mfaNotice && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {mfaNotice}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {mfaStep === "none" && (
            <>
              <form onSubmit={handleAuthSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-zinc-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="username"
                    type="email"
                    autoComplete="username"
                    required
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "email-error" : undefined}
                    value={email}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEmail(next);
                      if (emailError) setEmailError(validateEmail(next));
                    }}
                    onBlur={() => {
                      if (email.length > 0) setEmailError(validateEmail(email));
                    }}
                    placeholder="you@example.com"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                      emailError
                        ? "border-red-400 focus:border-red-500"
                        : "border-zinc-300 focus:border-emerald-500"
                    }`}
                  />
                  {emailError && (
                    <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">
                      {emailError}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-zinc-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
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
                  disabled={authBusy}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {authBusy
                    ? "Verifying..."
                    : authMode === "login"
                      ? "Sign In"
                      : "Create Account"}
                </button>
              </form>

              {authMode === "login" && isPasswordCredentialSupported() && (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleSavedCredentialLogin}
                  className="mt-2.5 w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Sign In with Saved Password
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAuthMode(authMode === "login" ? "register" : "login");
                }}
                className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-800"
              >
                {authMode === "login"
                  ? "Need an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </>
          )}

          {mfaStep === "passkey" && pendingMfa && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
                <p className="font-semibold text-emerald-900">
                  {pendingMfa.hasPasskey ? "Passkey Verification" : "Set Up Your Passkey"}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  {pendingMfa.hasPasskey
                    ? "Confirm your identity using Touch ID, Face ID, or your device passkey."
                    : "Protect your finance account by registering a passkey on this device."}
                </p>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={handleRetryPasskey}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {authBusy
                  ? "Waiting for Passkey..."
                  : pendingMfa.hasPasskey
                    ? "Verify with Passkey"
                    : "Register Passkey"}
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => triggerEmailOtpFallback(pendingMfa)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Use Email OTP Instead
              </button>
            </div>
          )}

          {mfaStep === "otp" && pendingMfa && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                Enter the 6-digit verification code sent to{" "}
                <span className="font-semibold text-zinc-900">{pendingMfa.email}</span>.
                {otpInfo?.devCode && (
                  <p className="mt-1.5 rounded bg-emerald-50 px-2 py-1 font-mono text-emerald-800">
                    Dev SMTP preview code: <strong>{otpInfo.devCode}</strong>
                  </p>
                )}
              </div>
              <form onSubmit={handleOtpSubmit} className="space-y-3">
                <div>
                  <label htmlFor="otp-code" className="block text-xs font-medium text-zinc-700">
                    6-Digit Email Code
                  </label>
                  <input
                    id="otp-code"
                    name="one-time-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy || otpCode.length !== 6}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {authBusy ? "Verifying Code..." : "Verify Email Code"}
                </button>
              </form>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => triggerEmailOtpFallback(pendingMfa)}
                  className="text-emerald-700 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleRetryPasskey}
                  className="text-zinc-600 hover:text-zinc-900 hover:underline disabled:opacity-50"
                >
                  Try Passkey Again
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMfaStep("none");
                  setPendingMfa(null);
                  setOtpCode("");
                  setOtpInfo(null);
                  setMfaNotice(null);
                  setError(null);
                }}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-800"
              >
                Back to Sign In
              </button>
            </div>
          )}
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

            {/* Security & Passkeys */}
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Security &amp; Passkeys (WebAuthn)</h2>
                  <p className="text-xs text-zinc-500">
                    Passkeys protect sign-ins after password entry, with Email OTP via SMTP as
                    fallback.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !isPasskeySupported()}
                  onClick={handleRegisterNewPasskey}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Add Passkey
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {passkeys.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No passkeys registered yet. Add one for phishing-resistant two-step sign-in.
                  </p>
                ) : (
                  passkeys.map((pk) => (
                    <div
                      key={pk.credentialId}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{pk.label}</p>
                        <p className="text-xs text-zinc-500">
                          Added {new Date(pk.createdAt).toLocaleDateString()}
                          {pk.lastUsedAt
                            ? ` • Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.deletePasskey(pk.credentialId);
                          await loadAppData();
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
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
