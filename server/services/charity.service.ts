/**
 * Charitable Giving Service (Stub)
 *
 * Supports percentage-based giving on eligible transactions and disbursement
 * to IRS-verified 501(c)(3) public charities (deductible under IRC § 170).
 */

import type { CharitableOrg, GivingRule } from "@shared/types";
import type { PlaidSyncedTransaction } from "./plaid.service";

/**
 * Determine if a posted debit transaction matches the user's GivingRule
 * and compute the charitable allocation in cents.
 */
export function calculatePercentageDonationCents(
  _txn: PlaidSyncedTransaction & { category?: string },
  _rule: GivingRule,
): number {
  // TODO: Return 0 if !rule.enabled, txn.pending, or txn.amountCents <= 0
  // TODO: If rule.eligibleCategories is non-empty, verify txn.category is included
  // TODO: Compute Math.round((txn.amountCents * rule.percentageBps) / 10_000)
  // TODO: Enforce optional per-transaction or monthly giving cap from user settings
  return 0;
}

/**
 * Search and verify active IRS 501(c)(3) organizations
 * (e.g., via Every.org, Change, Pledge, or IRS Publication 78 / BMF).
 */
export async function searchVerifiedCharities(
  _query: string,
  _category?: string,
): Promise<CharitableOrg[]> {
  // TODO: Query charity directory API using native fetch
  // TODO: Filter strictly to active IRS 501(c)(3) public charities eligible under IRC § 170
  // TODO: Cache directory results in MongoDB / memory to respect rate limits
  // TODO: Return curated environmental/green fallback list when running in sandbox mode
  return [];
}

/**
 * Disburse settled ACH funds directly to a verified 501(c)(3) organization.
 */
export async function disburseToCharity(_params: {
  userId: string;
  charityEin: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ externalDonationId: string; receiptUrl?: string }> {
  // TODO: Re-verify charityEin is still an active 501(c)(3) before disbursement
  // TODO: Submit donation via giving-as-a-service partner API (e.g., Every.org / Change)
  // TODO: Persist externalDonationId, charityEin, and official receipt URL on DonationLedgerModel
  throw new Error("disburseToCharity is not implemented yet");
}
