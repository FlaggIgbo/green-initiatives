import type { FormEvent } from "react";
import { AlertBanner } from "../components/ui/AlertBanner";
import { CredentialsForm } from "../components/auth/CredentialsForm";
import { PasskeyChallengeCard } from "../components/auth/PasskeyChallengeCard";
import { EmailOtpCard } from "../components/auth/EmailOtpCard";

export interface AuthPageProps {
  authMode: "login" | "register";
  email: string;
  emailError: string | null;
  password: string;
  mfaStep: "none" | "passkey" | "otp";
  mfaEmail?: string;
  hasPasskey?: boolean;
  otpCode: string;
  otpDevCode?: string;
  mfaNotice: string | null;
  error: string | null;
  busy: boolean;
  showSavedCredentialButton: boolean;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPasswordChange: (value: string) => void;
  onAuthSubmit: (e: FormEvent) => void;
  onSavedCredentialLogin: () => void;
  onToggleMode: () => void;
  onRetryPasskey: () => void;
  onUseEmailOtp: () => void;
  onOtpCodeChange: (code: string) => void;
  onOtpSubmit: (e: FormEvent) => void;
  onResendOtp: () => void;
  onBackToSignIn: () => void;
}

export function AuthPage({
  authMode,
  email,
  emailError,
  password,
  mfaStep,
  mfaEmail,
  hasPasskey = false,
  otpCode,
  otpDevCode,
  mfaNotice,
  error,
  busy,
  showSavedCredentialButton,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onAuthSubmit,
  onSavedCredentialLogin,
  onToggleMode,
  onRetryPasskey,
  onUseEmailOtp,
  onOtpCodeChange,
  onOtpSubmit,
  onResendOtp,
  onBackToSignIn,
}: AuthPageProps) {
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
          <div className="mb-4">
            <AlertBanner variant="warning" message={mfaNotice} compact />
          </div>
        )}

        {error && (
          <div className="mb-4">
            <AlertBanner variant="error" message={error} />
          </div>
        )}

        {mfaStep === "none" && (
          <CredentialsForm
            authMode={authMode}
            email={email}
            emailError={emailError}
            password={password}
            busy={busy}
            showSavedCredentialButton={showSavedCredentialButton}
            onEmailChange={onEmailChange}
            onEmailBlur={onEmailBlur}
            onPasswordChange={onPasswordChange}
            onSubmit={onAuthSubmit}
            onSavedCredentialLogin={onSavedCredentialLogin}
            onToggleMode={onToggleMode}
          />
        )}

        {mfaStep === "passkey" && (
          <PasskeyChallengeCard
            hasPasskey={hasPasskey}
            busy={busy}
            onRetryPasskey={onRetryPasskey}
            onUseEmailOtp={onUseEmailOtp}
          />
        )}

        {mfaStep === "otp" && (
          <EmailOtpCard
            email={mfaEmail ?? email}
            otpCode={otpCode}
            devCode={otpDevCode}
            busy={busy}
            onOtpCodeChange={onOtpCodeChange}
            onSubmit={onOtpSubmit}
            onResend={onResendOtp}
            onRetryPasskey={onRetryPasskey}
            onBack={onBackToSignIn}
          />
        )}
      </div>
    </div>
  );
}
