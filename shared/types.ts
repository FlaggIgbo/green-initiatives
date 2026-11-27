export interface EsgHolding {
  symbol: string;
  name: string;
  weight: number; // 0..1 (basket weights sum to 1.0)
}

export interface EsgBasket {
  id: string;
  name: string;
  description: string;
  holdings: EsgHolding[];
}

export interface PublicUser {
  id: string;
  email: string;
  roundUpEnabled: boolean;
  selectedBasketId: string;
  roundUpBalanceCents: number;
}

export interface LinkedAccount {
  id: string;
  plaidItemId: string;
  plaidAccountId: string;
  institutionName: string;
  accountName: string;
  mask: string;
  createdAt: string;
}

export interface RoundUpTransaction {
  id: string;
  plaidTransactionId: string;
  merchantName: string;
  amountCents: number;
  roundUpCents: number;
  date: string;
}

export type LedgerStatus = "ACCRUED" | "PENDING_SETTLEMENT" | "INVESTED" | "FAILED";

export interface LedgerEntry {
  id: string;
  idempotencyKey: string;
  status: LedgerStatus;
  amountCents: number;
  basketId: string;
  brokerOrderIds: string[];
  createdAt: string;
}

export interface PortfolioPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
}

export interface RoundUpSummary {
  balanceCents: number;
  thresholdCents: number;
  roundUpEnabled: boolean;
  selectedBasketId: string;
  recentTransactions: RoundUpTransaction[];
  ledgerEntries: LedgerEntry[];
}
