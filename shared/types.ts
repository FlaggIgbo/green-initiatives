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

// Charitable Giving, DAF & Tax Document Types (IRC § 170 / § 4966)
export type GivingDestinationType = "DIRECT_501C3" | "DAF";

export interface GivingRule {
  id: string;
  enabled: boolean;
  /** Basis points (e.g., 150 = 1.5% of eligible transaction amount) */
  percentageBps: number;
  /** Optional Plaid personal_finance_category filters (empty = all posted debits) */
  eligibleCategories: string[];
  /** Split between direct 501(c)(3) charity vs. tax-advantaged DAF (must sum to 100) */
  directCharitySplitPct: number;
  dafSplitPct: number;
  selectedCharityEin: string;
}

export interface CharitableOrg {
  ein: string;
  name: string;
  nteeCategory: string;
  verified501c3: boolean;
}

export type DonationStatus =
  "ACCRUED" | "ACH_PENDING" | "ACH_SETTLED" | "DISBURSED" | "FAILED" | "RETURNED";

export interface DonationLedgerEntry {
  id: string;
  idempotencyKey: string;
  achTransferId?: string;
  destinationType: GivingDestinationType;
  recipientEin: string;
  recipientName: string;
  amountCents: number;
  status: DonationStatus;
  settledAt?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface TaxReceiptSummary {
  taxYear: number;
  totalDeductibleCents: number;
  directDonationsCents: number;
  dafContributionsCents: number;
  /** True if any single gift >= 25000 cents ($250) per IRC § 170(f)(8) */
  requiresWrittenAcknowledgment: boolean;
  generatedAt: string;
}
