import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";
import type { LinkedBankAccount, RoundUpTransaction, RoundUpBatch } from "@shared/schema-mongo";

export const getLinkedAccounts = async (): Promise<LinkedBankAccount[]> => {
  const response = await fetch(getApiUrl("/api/roundup/linked-accounts"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch linked accounts");
  }
  return response.json();
};

export const createLinkSession = async (): Promise<string> => {
  const returnUrl = window.location.origin + "/settings";
  const response = await fetch(getApiUrl("/api/roundup/link-bank"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ returnUrl }),
    credentials: "include",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create link session");
  }
  const data = await response.json();
  return data.clientSecret;
};

export const createMockLinkAccount = async (data: {
  displayName?: string;
  institutionName?: string;
  last4?: string;
}): Promise<LinkedBankAccount> => {
  const response = await fetch(getApiUrl("/api/roundup/link-bank-mock"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to create mock link session");
  }
  return response.json();
};

export const unlinkAccount = async (stripeAccountId: string): Promise<void> => {
  const response = await fetch(getApiUrl(`/api/roundup/linked-accounts/${stripeAccountId}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to unlink account");
  }
};

export const getRecentRoundUpTransactions = async (limit = 10): Promise<RoundUpTransaction[]> => {
  const response = await fetch(getApiUrl(`/api/roundup/recent-transactions?limit=${limit}`), {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch round-up transactions");
  }
  return response.json();
};

export interface RoundUpSummary {
  balanceCents: number;
  batches: RoundUpBatch[];
}

export const getRoundUpSummary = async (): Promise<RoundUpSummary> => {
  const response = await fetch(getApiUrl("/api/roundup/summary"), {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch round-up summary");
  }
  return response.json();
};
