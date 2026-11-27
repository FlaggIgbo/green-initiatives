import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";
import type {
  LinkedBankAccount,
  RoundUpTransaction,
  RoundUpBatch,
  PortfolioPosition,
  EsgHoldingWeight,
} from "@shared/schema-mongo";

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

// ============================================
// TODO: Plaid Link, Alpaca Portfolio & AI Rebalancer Client Stubs
// ============================================

/**
 * TODO(Plaid): Request a Plaid Link token from POST /api/roundup/plaid/link-token
 * to initialize react-plaid-link (`usePlaidLink`) in Settings.
 */
export const createPlaidLinkToken = async (): Promise<{ linkToken: string }> => {
  throw new Error("TODO: Implement createPlaidLinkToken -> POST /api/roundup/plaid/link-token");
};

/**
 * TODO(Plaid): Send the `public_token` returned by Plaid Link `onSuccess` to
 * POST /api/roundup/plaid/exchange-token to persist the linked bank account.
 */
export const exchangePlaidPublicToken = async (
  _publicToken: string,
  _metadata?: { institutionName?: string; accountId?: string; mask?: string },
): Promise<LinkedBankAccount> => {
  throw new Error(
    "TODO: Implement exchangePlaidPublicToken -> POST /api/roundup/plaid/exchange-token",
  );
};

/**
 * TODO(Alpaca): Fetch live fractional ESG ETF positions, cost basis, and unrealized P&L
 * from GET /api/portfolio/positions for the /profile dashboard.
 */
export const getPortfolioPositions = async (): Promise<PortfolioPosition[]> => {
  throw new Error("TODO: Implement getPortfolioPositions -> GET /api/portfolio/positions");
};

/**
 * TODO(AI Rebalancer): Send natural-language portfolio rule to POST /api/esg/rebalance
 * and return the Zod-validated target ETF allocation weights.
 */
export const rebalancePortfolioWithPrompt = async (
  _prompt: string,
): Promise<{ rationale: string; holdings: EsgHoldingWeight[] }> => {
  throw new Error("TODO: Implement rebalancePortfolioWithPrompt -> POST /api/esg/rebalance");
};

/**
 * TODO(Tax Reporting): Download tax-lot / dividend reinvestment CSV from
 * GET /api/portfolio/tax-lots.csv?year=<taxYear>.
 */
export const exportTaxLotsCsv = async (_taxYear: number): Promise<Blob> => {
  throw new Error("TODO: Implement exportTaxLotsCsv -> GET /api/portfolio/tax-lots.csv");
};
