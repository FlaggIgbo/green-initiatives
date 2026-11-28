import type { FormEvent } from "react";

export interface EmailOtpCardProps {
  email: string;
  otpCode: string;
  devCode?: string;
  busy: boolean;
  onOtpCodeChange: (code: string) => void;
  onSubmit: (e: FormEvent) => void;
  onResend: () => void;
  onRetryPasskey: () => void;
  onBack: () => void;
}

export function EmailOtpCard({
  email,
  otpCode,
  devCode,
  busy,
  onOtpCodeChange,
  onSubmit,
  onResend,
  onRetryPasskey,
  onBack,
}: EmailOtpCardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        Enter the 6-digit verification code sent to{" "}
        <span className="font-semibold text-zinc-900">{email}</span>.
        {devCode && (
          <p className="mt-1.5 rounded bg-emerald-50 px-2 py-1 font-mono text-emerald-800">
            Dev SMTP preview code: <strong>{devCode}</strong>
          </p>
        )}
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
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
            onChange={(e) => onOtpCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || otpCode.length !== 6}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Verifying Code..." : "Verify Email Code"}
        </button>
      </form>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={onResend}
          className="text-emerald-700 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRetryPasskey}
          className="text-zinc-600 hover:text-zinc-900 hover:underline disabled:opacity-50"
        >
          Try Passkey Again
        </button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-800"
      >
        Back to Sign In
      </button>
    </div>
  );
}
