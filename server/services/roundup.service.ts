import crypto from "node:crypto";
import {
  LedgerEntryModel,
  LinkedAccountModel,
  RoundUpTransactionModel,
  UserModel,
} from "../models";
import { syncPlaidTransactions } from "./plaid.service";
import { submitBasketOrders } from "./alpaca.service";

export const ROUNDUP_THRESHOLD_CENTS = 500; // $5.00 Acorns-style threshold

/**
 * Calculate spare-change round-up for a posted debit in cents.
 * Example: 435 cents ($4.35) -> 65 cents ($0.65). Exact dollars return 0.
 */
export function calculateRoundUpCents(debitAmountCents: number): number {
  if (debitAmountCents <= 0) return 0;
  const remainder = debitAmountCents % 100;
  return remainder === 0 ? 0 : 100 - remainder;
}

/**
 * Pull new posted transactions from all linked Plaid accounts for a user,
 * deduplicate by plaidTransactionId, and accrue round-up cents.
 */
export async function syncUserRoundUps(userId: string): Promise<{
  addedCount: number;
  accruedCents: number;
  balanceCents: number;
}> {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error("User not found");

  const accounts = await LinkedAccountModel.find({ userId });
  let addedCount = 0;
  let accruedCents = 0;

  for (const account of accounts) {
    const { transactions, nextCursor } = await syncPlaidTransactions(
      account.accessToken,
      account.syncCursor,
    );

    for (const txn of transactions) {
      if (txn.pending || txn.amountCents <= 0) continue;
      const roundUpCents = calculateRoundUpCents(txn.amountCents);
      if (roundUpCents <= 0) continue;

      const exists = await RoundUpTransactionModel.exists({
        plaidTransactionId: txn.transactionId,
      });
      if (exists) continue;

      await RoundUpTransactionModel.create({
        userId,
        plaidTransactionId: txn.transactionId,
        merchantName: txn.merchantName,
        amountCents: txn.amountCents,
        roundUpCents,
        date: txn.date,
      });

      addedCount++;
      accruedCents += roundUpCents;
      // TODO: Evaluate calculatePercentageDonationCents(txn, user.givingRule) and accrue to user.givingBalanceCents
    }

    account.syncCursor = nextCursor;
    await account.save();
  }

  if (accruedCents > 0) {
    user.roundUpBalanceCents += accruedCents;
    await user.save();
  }

  return { addedCount, accruedCents, balanceCents: user.roundUpBalanceCents };
}

/**
 * Flush accumulated round-ups >= $5 into the user's selected ESG basket via Alpaca.
 */
export async function flushUserRoundUps(userId: string): Promise<{
  investedCents: number;
  status: string;
  orderIds: string[];
}> {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.roundUpBalanceCents < ROUNDUP_THRESHOLD_CENTS) {
    return { investedCents: 0, status: "BELOW_THRESHOLD", orderIds: [] };
  }

  const amountCents = user.roundUpBalanceCents;
  const basketId = user.selectedBasketId || "clean-energy-grid";
  const idempotencyKey = `flush_${userId}_${crypto.randomUUID().slice(0, 8)}`;

  // Deduct balance first; restore on failure
  user.roundUpBalanceCents = 0;
  await user.save();

  try {
    const { orderIds, status } = await submitBasketOrders({
      basketId,
      amountCents,
      idempotencyKey,
    });

    await LedgerEntryModel.create({
      userId,
      idempotencyKey,
      status,
      amountCents,
      basketId,
      brokerOrderIds: orderIds,
    });

    return { investedCents: amountCents, status, orderIds };
  } catch (err) {
    user.roundUpBalanceCents += amountCents;
    await user.save();
    await LedgerEntryModel.create({
      userId,
      idempotencyKey,
      status: "FAILED",
      amountCents,
      basketId,
      brokerOrderIds: [],
    });
    throw err;
  }
}

/**
 * Flush accumulated percentage-based charitable giving via ACH debit,
 * splitting settled funds between direct 501(c)(3) donation and the user's DAF.
 */
export async function flushUserGiving(_userId: string): Promise<{
  transferredCents: number;
  status: string;
  achTransferId?: string;
}> {
  // TODO: Load user, check user.givingBalanceCents >= GIVING_THRESHOLD_CENTS and verify NACHA consent
  // TODO: Deduct user.givingBalanceCents optimistically (restore on failure) and generate idempotencyKey
  // TODO: Call initiateAchDebit(...) from ./ach.service
  // TODO: Create DonationLedgerModel entries (ACH_PENDING) for directCharitySplitPct and dafSplitPct
  // TODO: On ACH settlement webhook, call disburseToCharity(...) and/or contributeToDaf(...)
  throw new Error("flushUserGiving is not implemented yet");
}
