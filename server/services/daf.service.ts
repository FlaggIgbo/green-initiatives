/**
 * Donor-Advised Fund (DAF) Service (Stub)
 *
 * Integrates with a 501(c)(3) DAF sponsoring organization (e.g., Endaoment, Daffy,
 * or Charityvest) under IRC § 4966 / § 170(f)(18). Contributions to a DAF are
 * immediately tax-deductible in the year contributed, can grow tax-free, and can
 * be granted out to verified 501(c)(3) charities over time.
 */

/**
 * Provision or link a user's Donor-Advised Fund sub-account with a 501(c)(3) DAF sponsor.
 */
export async function provisionUserDafAccount(
  _userId: string,
): Promise<{ dafAccountId: string; sponsorEin: string; status: string }> {
  // TODO: Collect KYC/identity fields required by the DAF sponsor (legal name, address, DOB)
  // TODO: Call DAF partner API to create or link the user's fund sub-account
  // TODO: Persist dafAccountId and sponsorEin on UserModel
  throw new Error("provisionUserDafAccount is not implemented yet");
}

/**
 * Contribute settled ACH funds into the user's DAF (tax-deductible under IRC § 170).
 */
export async function contributeToDaf(_params: {
  userId: string;
  dafAccountId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ contributionId: string; taxReceiptId: string }> {
  // TODO: Transfer settled funds to the DAF sponsor FBO account via partner API
  // TODO: Record contribution settlement date & sponsor EIN for tax-year attribution
  // TODO: Optionally allocate DAF cash balance into an ESG investment pool
  throw new Error("contributeToDaf is not implemented yet");
}

/**
 * Recommend a grant from the user's DAF balance to a verified 501(c)(3) charity.
 */
export async function recommendDafGrant(_params: {
  userId: string;
  dafAccountId: string;
  charityEin: string;
  amountCents: number;
}): Promise<{ grantId: string; status: string }> {
  // TODO: Validate available DAF balance >= amountCents
  // TODO: Submit grant recommendation to DAF sponsor (sponsor performs final 501(c)(3) vetting)
  // TODO: Note: DAF grant-outs are NOT deductible a second time; exclude from tax summary totals
  throw new Error("recommendDafGrant is not implemented yet");
}
