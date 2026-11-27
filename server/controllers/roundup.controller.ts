import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { paymentService } from "../services/payment.service";
import { flushRoundUpBalances } from "../services/roundup.service";
import { storage } from "../mongo/storage";
import { logger } from "../logger";

export class RoundupController {
  /** Create a Financial Connections session for bank linking. Returns client_secret. */
  createLinkSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let returnUrl = req.body.returnUrl || req.get("origin") || "";
    if (!returnUrl) {
      res.status(400).json({ error: "returnUrl is required" });
      return;
    }
    // Stripe requires HTTPS for return_url. For local dev (http://localhost), use an override.
    // Run: ngrok http 8000, then set STRIPE_RETURN_URL_OVERRIDE=https://your-id.ngrok.io/settings
    const override = process.env.STRIPE_RETURN_URL_OVERRIDE;
    if (override && returnUrl.startsWith("http://")) {
      returnUrl = override;
    }

    const clientSecret = await paymentService.createFinancialConnectionsSession(
      req.user.id,
      returnUrl,
    );
    res.json({ clientSecret });
  });

  /** List linked bank accounts for the current user */
  getLinkedAccounts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const accounts = await storage.getLinkedBankAccounts(req.user.id);
    res.json(accounts);
  });

  /** Unlink a bank account (soft delete) */
  unlinkAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const stripeAccountId = String(req.params.id);
    if (!stripeAccountId) {
      res.status(400).json({ error: "Account ID required" });
      return;
    }

    const account = await storage.getLinkedBankAccountByStripeId(stripeAccountId);
    if (!account || String(account.userId) !== req.user.id) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    await storage.removeLinkedBankAccount(req.user.id, stripeAccountId);
    logger.info("Bank account unlinked", { userId: req.user.id, accountId: stripeAccountId });
    res.status(204).send();
  });

  /** Get recent round-up transactions for the current user */
  getRecentTransactions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const transactions = await storage.getRoundUpTransactionsForUser(req.user.id, limit);
    res.json(transactions);
  });

  /** Get round-up balance and recent batches for the current user */
  getRoundUpSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await storage.getUser(req.user.id);
    const batches = await storage.getRoundUpBatchesForUser(req.user.id, 5);
    res.json({
      balanceCents: user?.roundUpBalanceCents ?? 0,
      batches,
    });
  });

  /**
   * Cron: Flush accumulated round-up balances >= $5 (Acorns-style).
   * Secured by ROUNDUP_CRON_SECRET header. Invoke via Cloud Scheduler:
   *   gcloud scheduler jobs create http flush-roundups \
   *     --schedule="0 0,6,12,18 * * *" \
   *     --uri="https://YOUR-SERVICE.run.app/api/cron/flush-roundups" \
   *     --http-method=POST \
   *     --headers="X-Cron-Secret=YOUR_SECRET"
   *   (every 6 hours: 0:00, 6:00, 12:00, 18:00 UTC)
   */
  flushRoundUpsCron = asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.ROUNDUP_CRON_SECRET;
    const headerSecret = req.get("X-Cron-Secret");
    if (secret && headerSecret !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bypassStripeCheck =
      req.get("X-Bypass-Stripe-Check") === "true" ||
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "sandbox" ||
      req.get("x-playwright-test") === "true";
    const result = await flushRoundUpBalances(bypassStripeCheck);
    logger.info("Round-up cron completed", result);
    res.json(result);
  });

  /** POST: Link a mock bank account immediately (Simulated Teller connection) */
  createMockLink = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { institutionName, last4, displayName } = req.body;

    const mockAccount = await storage.createLinkedBankAccount({
      userId: req.user.id,
      stripeAccountId: "mock_acc_" + Math.random().toString(36).substring(2, 11),
      displayName: displayName || "Checking Account",
      institutionName: institutionName || "Teller Sandbox Bank",
      last4: last4 || "4321",
    });

    // In development or sandbox mode, link a starting $10.00 round-up balance so the cron loop is immediately testable!
    await storage.addRoundUpBalance(req.user.id, 1000);

    logger.info("Linked bank account created (Mock/Teller)", {
      userId: req.user.id,
      accountId: mockAccount.stripeAccountId,
      institution: mockAccount.institutionName,
    });

    res.status(201).json(mockAccount);
  });
}

export const roundupController = new RoundupController();
