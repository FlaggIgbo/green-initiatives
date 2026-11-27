/**
 * Charitable Tax Document Service (Stub)
 *
 * Aggregates cash-basis charitable donations and DAF contributions by tax year
 * and generates downloadable Schedule A helper packets + IRC § 170(f)(8)
 * contemporaneous written acknowledgment summaries.
 */

import type { TaxReceiptSummary } from "@shared/types";

/**
 * Aggregate all settled/disbursed tax-deductible donations and DAF contributions for a tax year.
 */
export async function buildAnnualTaxSummary(
  _userId: string,
  _taxYear: number,
): Promise<TaxReceiptSummary> {
  // TODO: Query DonationLedgerModel for userId where status in ["ACH_SETTLED", "DISBURSED"]
  //       and settledAt falls within [taxYear-01-01, taxYear-12-31] (cash-basis accounting)
  // TODO: Exclude DAF grant-outs (deduction already occurred when contributed to the DAF)
  // TODO: Sum directDonationsCents and dafContributionsCents
  // TODO: Set requiresWrittenAcknowledgment = true if any single contribution >= 25000 cents ($250)
  throw new Error("buildAnnualTaxSummary is not implemented yet");
}

/**
 * Generate a downloadable PDF or CSV charitable tax packet for IRS Form 1040 Schedule A.
 */
export async function generateTaxDocumentPacket(
  _userId: string,
  _taxYear: number,
  _format: "pdf" | "csv",
): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
  // TODO: Call buildAnnualTaxSummary(userId, taxYear)
  // TODO: Include itemized ledger: date, recipient legal name, EIN, amount, confirmation ID
  // TODO: Include IRC § 170(f)(8) disclosure ("No goods or services were provided in exchange...")
  //       and attach/link official receipts issued by each 501(c)(3) or DAF sponsor
  // TODO: Include disclaimer that document is for tax preparation and not formal tax advice
  // TODO: Render PDF (e.g., pdf-lib / pdfkit) or CSV buffer and archive metadata in TaxDocumentModel
  throw new Error("generateTaxDocumentPacket is not implemented yet");
}
