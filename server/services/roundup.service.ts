import Stripe from "stripe";
import { storage } from "../mongo/storage";
import { projectService } from "./project.service";
import { logger } from "../logger";
import type { RoundUpMultiplierRule } from "@shared/schema-mongo";

export interface TransactionClassificationResult {
  category: string;
  multiplier: number;
  estimatedCarbonGrams: number;
  classifierSource: "rules" | "llm" | "fallback";
}

/**
 * Hybrid Transaction Classification & Carbon-Adjusted Multiplier (Stub)
 * TODO:
 * 1. Run fast deterministic merchant/MCC rules first (e.g., Shell, Delta, Uber, Whole Foods)
 * 2. Fall back to lightweight LLM/embedding classifier for messy bank statement strings
 * 3. Apply user's dynamic RoundUpMultiplierRule (e.g., 2x gas/airlines, 1x groceries, or flight CO2 match)
 * 4. Gracefully degrade to 1x multiplier if external AI API times out
 */
export async function classifyTransactionAndMultiplier(_input: {
  merchantName?: string;
  description: string;
  mcc?: string;
  amountCents: number;
  userRules?: RoundUpMultiplierRule[];
}): Promise<TransactionClassificationResult> {
  // TODO: Replace stub with rules-first + LLM-fallback pipeline
  return {
    category: "uncategorized",
    multiplier: 1,
    estimatedCarbonGrams: 0,
    classifierSource: "fallback",
  };
}

/**
 * Market-Hours Aware Flush Worker for Fractional ESG Investing (Stub)
 * TODO:
 * 1. Check `alpacaService.isMarketOpen()` — queue weekend/after-hours flushes as PENDING_SETTLEMENT
 * 2. Use `ledgerService.recordLedgerEntry()` + `idempotencyKey` inside a MongoDB transaction
 * 3. Route notional splits to `alpacaService.executeBasketOrders()` (or charitable projects)
 * 4. Trigger `projectService.generateRoundUpImpactDigest()` on settlement
 */
export async function enqueueOrExecuteFlush(
  _userId: string,
  _amountCents: number,
  _idempotencyKey: string,
): Promise<{ status: "QUEUED" | "INVESTED" | "FAILED" }> {
  throw new Error("TODO: Implement enqueueOrExecuteFlush with LedgerService + AlpacaService");
}

let stripeInstance: Stripe;

const getStripe = () => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not defined");
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
};

/**
 * Round-up calculation: $4.37 → $5.00 → round-up = $0.63 (63 cents).
 * Only applies to debits (negative amounts). Returns 0 for credits or tiny amounts.
 */
export function calculateRoundUpCents(amountCents: number): number {
  if (amountCents >= 0) return 0; // Credits, not debits
  const absCents = Math.abs(amountCents);
  const nextDollar = Math.ceil(absCents / 100) * 100;
  const roundUp = nextDollar - absCents;
  return roundUp;
}

/** Acorns-style threshold: donate when accumulated round-up reaches $5 */
const ROUNDUP_THRESHOLD_CENTS = 500;

/**
 * Process a single transaction: dedupe, calculate round-up, accumulate (Acorns-style).
 * Donations happen when balance reaches $5 via flushRoundUpBalances cron.
 */
export async function processTransaction(
  stripeTransactionId: string,
  amountCents: number,
  userId: string,
): Promise<{ processed: boolean; roundUpCents: number }> {
  if (process.env.STRIPE_DISABLED === "true") {
    return { processed: false, roundUpCents: 0 };
  }
  const roundUpCents = calculateRoundUpCents(amountCents);
  if (roundUpCents <= 0) return { processed: false, roundUpCents: 0 };

  const existing = await storage.getProcessedRoundUpTransaction(stripeTransactionId);
  if (existing) return { processed: false, roundUpCents };

  const user = await storage.getUser(userId);
  if (!user?.roundUpEnabled) return { processed: false, roundUpCents };

  const projectIds = user.roundUpProjectIds?.length
    ? user.roundUpProjectIds
    : user.selectedRoundUpProject
      ? [user.selectedRoundUpProject]
      : [];

  if (projectIds.length === 0) {
    logger.info("Round-up skipped: no projects selected", { userId, stripeTransactionId });
    return { processed: false, roundUpCents };
  }

  // TODO(Plaid + AI + Ledger):
  // 1. Call `classifyTransactionAndMultiplier()` to apply carbon-adjusted 1x/2x/3x multipliers
  // 2. Replace mutable `addRoundUpBalance()` with `ledgerService.recordLedgerEntry()` using
  //    plaidTransactionId as the idempotency key inside a MongoDB transaction
  // Accumulate round-up (Acorns-style: donate when >= $5)
  const newBalanceCents = await storage.addRoundUpBalance(userId, roundUpCents);

  await storage.createRoundUpTransaction({
    userId,
    stripeTransactionId,
    originalAmountCents: amountCents,
    roundUpAmount: roundUpCents / 100,
  });

  logger.info("Round-up accumulated", {
    userId,
    stripeTransactionId,
    roundUpCents,
    newBalanceCents,
  });

  return { processed: true, roundUpCents };
}

/**
 * Handle refreshed transactions for a Financial Connections account.
 * Called from webhook when financial_connections.account.refreshed_transactions fires.
 */
export async function processRefreshedTransactions(
  accountId: string,
  transactionRefreshId?: string,
): Promise<void> {
  const linkedAccount = await storage.getLinkedBankAccountByStripeId(accountId);
  if (!linkedAccount) {
    logger.warn("Round-up: linked account not found", { accountId });
    return;
  }

  const userId = String(linkedAccount.userId);

  const params: Stripe.FinancialConnections.TransactionListParams = {
    account: accountId,
  };
  if (transactionRefreshId) {
    params.transaction_refresh = { after: transactionRefreshId };
  }

  const transactions = await getStripe().financialConnections.transactions.list(params);

  for (const txn of transactions.data) {
    if (txn.status !== "posted") continue;
    const amountCents = txn.amount ?? 0;
    if (amountCents >= 0) continue; // Only debits

    try {
      await processTransaction(txn.id, amountCents, userId);
    } catch (err) {
      logger.error("Round-up processTransaction failed", {
        txnId: txn.id,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (transactions.data.length > 0 && transactionRefreshId) {
    await storage.updateLinkedBankAccountLastRefresh(accountId, transactionRefreshId);
  }
}

/**
 * Flush accumulated round-up balances >= $5 (Acorns-style).
 * Call from cron (e.g. Cloud Scheduler → /api/cron/flush-roundups).
 * TODO(Alpaca + Ledger): Swap project funding loop for `enqueueOrExecuteFlush()` with
 * idempotency keys, double-entry ledger transitions, market-hours queueing (9:35 AM ET),
 * and fractional ESG ETF execution via AlpacaService.
 */
export async function flushRoundUpBalances(
  bypassStripeCheck = false,
): Promise<{ flushed: number; errors: number }> {
  if (process.env.STRIPE_DISABLED === "true" && !bypassStripeCheck) {
    logger.info("Round-up flush skipped: payments are disabled");
    return { flushed: 0, errors: 0 };
  }
  const users = await storage.getUsersWithRoundUpBalanceAbove(ROUNDUP_THRESHOLD_CENTS);
  let flushed = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const result = await storage.flushRoundUpBalance(user.id, ROUNDUP_THRESHOLD_CENTS);
      if (!result || result.projectIds.length === 0) continue;

      const amountDollars = result.amountCents / 100;
      const amountPerProject = amountDollars / result.projectIds.length;

      for (const projectId of result.projectIds) {
        try {
          await projectService.processFunding(projectId, amountPerProject, user.id);
        } catch (err) {
          logger.error("Round-up flush: processFunding failed", {
            projectId,
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          });
          errors++;
        }
      }

      await storage.createRoundUpBatch({
        userId: user.id,
        amountCents: result.amountCents,
        projectIds: result.projectIds,
      });

      flushed++;
      logger.info("Round-up flushed", {
        userId: user.id,
        amountCents: result.amountCents,
        projectIds: result.projectIds,
      });
    } catch (err) {
      logger.error("Round-up flush failed for user", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  return { flushed, errors };
}
