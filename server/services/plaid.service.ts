/**
 * Plaid Banking Integration Service (Stubs)
 *
 * Uses native fetch() against Plaid API (sandbox / development / production) with
 * PLAID_CLIENT_ID and PLAID_SECRET (matching the pattern in ~/git/budget-app).
 *
 * TODO: Implement full Plaid Link + cursor-based transactions/sync flow.
 */

export interface PlaidLinkTokenResult {
  linkToken: string;
  expiration: string;
}

export interface PlaidExchangeResult {
  itemId: string;
  encryptedAccessToken: string;
}

export interface PlaidTransactionRecord {
  transactionId: string;
  accountId: string;
  amount: number; // Positive = debit in Plaid convention
  isoCurrencyCode?: string;
  merchantName?: string;
  name: string;
  pending: boolean;
  date: string;
  personalFinanceCategory?: {
    primary: string;
    detailed: string;
  };
}

export interface PlaidSyncResult {
  added: PlaidTransactionRecord[];
  modified: PlaidTransactionRecord[];
  removed: { transactionId: string }[];
  nextCursor: string;
  hasMore: boolean;
}

export class PlaidService {
  isConfigured(): boolean {
    return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  }

  /**
   * POST /link/token/create
   * TODO:
   * 1. Call Plaid /link/token/create with PLAID_CLIENT_ID, PLAID_SECRET, Plaid-Version: 2020-09-14
   * 2. Pass user: { client_user_id: userId }, products: ["transactions"], country_codes: ["US"]
   * 3. Attach PLAID_WEBHOOK_URL if configured for SYNC_UPDATES_AVAILABLE events
   */
  async createLinkToken(_userId: string): Promise<PlaidLinkTokenResult> {
    throw new Error("TODO: Implement PlaidService.createLinkToken");
  }

  /**
   * POST /item/public_token/exchange
   * TODO:
   * 1. Exchange publicToken for permanent access_token + item_id
   * 2. Encrypt access_token at rest (e.g., AES-256-GCM via KMS / GCP Secret Manager key)
   * 3. Return itemId and encryptedAccessToken for storage on LinkedBankAccount
   */
  async exchangePublicToken(_publicToken: string): Promise<PlaidExchangeResult> {
    throw new Error("TODO: Implement PlaidService.exchangePublicToken");
  }

  /**
   * POST /transactions/sync
   * TODO:
   * 1. Decrypt accessToken and paginate Plaid /transactions/sync starting from `cursor`
   * 2. Enforce pending vs. posted state machine: only lock round-up deltas when `pending === false`
   * 3. Handle modified/removed transactions and persist `nextCursor` on LinkedBankAccount
   * 4. Deduplicate using a unique index on `plaidTransactionId` in MongoDB
   */
  async syncTransactions(
    _encryptedAccessToken: string,
    _cursor?: string,
  ): Promise<PlaidSyncResult> {
    throw new Error("TODO: Implement PlaidService.syncTransactions");
  }

  /**
   * Verify Plaid webhook authenticity using the Plaid-Verification JWT header.
   * TODO:
   * 1. Decode JWT header `kid` and fetch JWK from /webhook_verification_key/get (cache keys)
   * 2. Verify ES256 signature, `iat` freshness (<= 5 min), and SHA-256 hash of `rawBody`
   */
  async verifyPlaidWebhook(_rawBody: string, _plaidVerificationHeader: string): Promise<boolean> {
    throw new Error("TODO: Implement PlaidService.verifyPlaidWebhook");
  }
}

export const plaidService = new PlaidService();
