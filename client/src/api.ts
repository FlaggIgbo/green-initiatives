import type {
  AuthStepResponse,
  EsgBasket,
  LinkedAccount,
  OtpSendResponse,
  PasskeySummary,
  PortfolioPosition,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  PublicUser,
  RoundUpSummary,
} from "@shared/types";
import type {
  SerializedPasskeyAssertion,
  SerializedPasskeyRegistration,
} from "./credentials";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getMe: () => request<{ user: PublicUser }>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<AuthStepResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<AuthStepResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  getPasskeyRegisterOptions: (mfaToken?: string) =>
    request<{ options: PublicKeyCredentialCreationOptionsJSON }>(
      "/api/auth/passkey/register/options",
      {
        method: "POST",
        body: JSON.stringify(mfaToken ? { mfaToken } : {}),
      },
    ),
  verifyPasskeyRegistration: (
    credential: SerializedPasskeyRegistration,
    mfaToken?: string,
  ) =>
    request<{ status: "authenticated"; user: PublicUser }>("/api/auth/passkey/register/verify", {
      method: "POST",
      body: JSON.stringify({ credential, ...(mfaToken ? { mfaToken } : {}) }),
    }),
  getPasskeyLoginOptions: (mfaToken: string) =>
    request<{ options: PublicKeyCredentialRequestOptionsJSON }>("/api/auth/passkey/login/options", {
      method: "POST",
      body: JSON.stringify({ mfaToken }),
    }),
  verifyPasskeyLogin: (credential: SerializedPasskeyAssertion, mfaToken: string) =>
    request<{ status: "authenticated"; user: PublicUser }>("/api/auth/passkey/login/verify", {
      method: "POST",
      body: JSON.stringify({ credential, mfaToken }),
    }),
  getPasskeys: () => request<PasskeySummary[]>("/api/auth/passkeys"),
  deletePasskey: (credentialId: string) =>
    request<void>(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
      method: "DELETE",
    }),

  sendEmailOtp: (mfaToken: string) =>
    request<OtpSendResponse>("/api/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ mfaToken }),
    }),
  verifyEmailOtp: (mfaToken: string, code: string) =>
    request<{ status: "authenticated"; user: PublicUser }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    }),

  getBaskets: () => request<EsgBasket[]>("/api/baskets"),
  getAccounts: () => request<LinkedAccount[]>("/api/plaid/accounts"),
  exchangePlaidToken: (payload: {
    publicToken: string;
    institutionName: string;
    accountName: string;
    mask: string;
  }) =>
    request<LinkedAccount>("/api/plaid/exchange", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  unlinkAccount: (id: string) => request<void>(`/api/plaid/accounts/${id}`, { method: "DELETE" }),
  syncPlaid: () =>
    request<{ addedCount: number; accruedCents: number; balanceCents: number }>("/api/plaid/sync", {
      method: "POST",
    }),

  getSummary: () => request<RoundUpSummary>("/api/roundup/summary"),
  updateSettings: (settings: { roundUpEnabled?: boolean; selectedBasketId?: string }) =>
    request<{ user: PublicUser }>("/api/roundup/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  flushRoundUps: () =>
    request<{ investedCents: number; status: string; orderIds: string[] }>("/api/roundup/flush", {
      method: "POST",
    }),
  getPositions: () => request<PortfolioPosition[]>("/api/portfolio/positions"),
};
