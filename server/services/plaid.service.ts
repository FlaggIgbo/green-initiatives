/**
 * Plaid API Service (Native fetch — zero Plaid SDK required)
 *
 * Uses PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox | development | production).
 * Falls back to deterministic sandbox data when credentials are not configured.
 */

const PLAID_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

const PLAID_VERSION = "2020-09-14";

export interface PlaidSyncedTransaction {
  transactionId: string;
  merchantName: string;
  amountCents: number; // Positive = debit (Plaid convention)
  pending: boolean;
  date: string;
  // TODO: Populate personal_finance_category.primary from /transactions/sync for category-based GivingRule filtering
  category?: string;
}

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

async function plaidPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const env = process.env.PLAID_ENV || "sandbox";
  const baseUrl = PLAID_URLS[env] || PLAID_URLS.sandbox;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Plaid-Version": PLAID_VERSION,
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
  });

  const data = (await response.json()) as T & { error_message?: string };
  if (!response.ok) {
    throw new Error(data.error_message || `Plaid API error (${response.status})`);
  }
  return data;
}

export async function createPlaidLinkToken(userId: string): Promise<{ linkToken: string }> {
  if (!isPlaidConfigured()) {
    return { linkToken: `link-sandbox-mock-${userId}` };
  }

  // TODO: Include "transfer" (or "auth") in PLAID_PRODUCTS when enabling ACH pulls for charitable giving / DAF
  const products = (process.env.PLAID_PRODUCTS || "transactions")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const countryCodes = (process.env.PLAID_COUNTRY_CODES || "US")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const data = await plaidPost<{ link_token: string }>("/link/token/create", {
    user: { client_user_id: userId },
    client_name: "Green Initiatives",
    products,
    country_codes: countryCodes,
    language: "en",
  });
  return { linkToken: data.link_token };
}

export async function exchangePlaidPublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  if (!isPlaidConfigured()) {
    return {
      accessToken: `access-sandbox-mock-${publicToken}`,
      itemId: `item_mock_${Date.now()}`,
    };
  }

  const data = await plaidPost<{ access_token: string; item_id: string }>(
    "/item/public_token/exchange",
    { public_token: publicToken },
  );
  return { accessToken: data.access_token, itemId: data.item_id };
}

/**
 * Incremental cursor-based transaction sync via Plaid /transactions/sync.
 * Only posted debits (`pending === false && amount > 0`) are eligible for round-ups.
 */
export async function syncPlaidTransactions(
  accessToken: string,
  cursor?: string,
): Promise<{ transactions: PlaidSyncedTransaction[]; nextCursor: string }> {
  if (!isPlaidConfigured() || accessToken.startsWith("access-sandbox-mock-")) {
    const seed = cursor ? Number(cursor.replace("mock_cursor_", "")) || 1 : 0;
    const today = new Date().toISOString().slice(0, 10);
    return {
      transactions: [
        {
          transactionId: `plaid_txn_${seed}_coffee`,
          merchantName: "Blue Bottle Coffee",
          amountCents: 435,
          pending: false,
          date: today,
        },
        {
          transactionId: `plaid_txn_${seed}_groceries`,
          merchantName: "Trader Joe's",
          amountCents: 2840,
          pending: false,
          date: today,
        },
        {
          transactionId: `plaid_txn_${seed}_transit`,
          merchantName: "Metro Transit",
          amountCents: 275,
          pending: false,
          date: today,
        },
      ],
      nextCursor: `mock_cursor_${seed + 1}`,
    };
  }

  const transactions: PlaidSyncedTransaction[] = [];
  let nextCursor = cursor || "";
  let hasMore = true;

  while (hasMore) {
    const data = await plaidPost<{
      added: Array<{
        transaction_id: string;
        merchant_name?: string;
        name: string;
        amount: number;
        pending: boolean;
        date: string;
      }>;
      next_cursor: string;
      has_more: boolean;
    }>("/transactions/sync", {
      access_token: accessToken,
      cursor: nextCursor || undefined,
    });

    for (const t of data.added) {
      transactions.push({
        transactionId: t.transaction_id,
        merchantName: t.merchant_name || t.name,
        amountCents: Math.round(t.amount * 100),
        pending: t.pending,
        date: t.date,
      });
    }
    nextCursor = data.next_cursor;
    hasMore = data.has_more;
  }

  return { transactions, nextCursor };
}
