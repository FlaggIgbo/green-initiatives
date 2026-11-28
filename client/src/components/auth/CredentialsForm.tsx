import type { FormEvent } from "react";

export interface CredentialsFormProps {
  authMode: "login" | "register";
  email: string;
  emailError: string | null;
  password: string;
  busy: boolean;
  showSavedCredentialButton: boolean;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onSavedCredentialLogin: () => void;
  onToggleMode: () => void;
}

export function CredentialsForm({
  authMode,
  email,
  emailError,
  password,
  busy,
  showSavedCredentialButton,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onSubmit,
  onSavedCredentialLogin,
  onToggleMode,
}: CredentialsFormProps) {
  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={onEmailBlur}
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
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Min 6 characters"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Verifying..." : authMode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      {authMode === "login" && showSavedCredentialButton && (
        <button
          type="button"
          disabled={busy}
          onClick={onSavedCredentialLogin}
          className="mt-2.5 w-full rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Sign In with Saved Password
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMode}
        className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-800"
      >
        {authMode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
