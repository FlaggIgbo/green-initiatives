import { Router } from "express";
import {
  clearSessionCookie,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from "./auth";
import { LedgerEntryModel, LinkedAccountModel, RoundUpTransactionModel, UserModel } from "./models";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "./services/plaid.service";
import { ESG_BASKETS, getPortfolioPositions } from "./services/alpaca.service";
import {
  flushUserRoundUps,
  ROUNDUP_THRESHOLD_CENTS,
  syncUserRoundUps,
} from "./services/roundup.service";
import type { PublicUser } from "@shared/types";

function toPublicUser(doc: {
  _id: unknown;
  email: string;
  roundUpEnabled: boolean;
  selectedBasketId: string;
  roundUpBalanceCents: number;
}): PublicUser {
  return {
    id: String(doc._id),
    email: doc.email,
    roundUpEnabled: doc.roundUpEnabled,
    selectedBasketId: doc.selectedBasketId,
    roundUpBalanceCents: doc.roundUpBalanceCents,
  };
}

export function createApiRouter(): Router {
  const router = Router();

  // Auth
  router.post("/auth/register", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || password.length < 6) {
      res.status(400).json({ error: "Valid email and password (min 6 chars) required" });
      return;
    }
    const existing = await UserModel.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "Account already exists" });
      return;
    }
    const user = await UserModel.create({ email, passwordHash: hashPassword(password) });
    setSessionCookie(res, String(user._id));
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.post("/auth/login", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const user = await UserModel.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    setSessionCookie(res, String(user._id));
    res.json({ user: toPublicUser(user) });
  });

  router.post("/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });

  // ESG Baskets
  router.get("/baskets", (_req, res) => {
    res.json(ESG_BASKETS);
  });

  // Plaid Bank Linking & Sync
  router.post("/plaid/link-token", requireAuth, async (req: AuthedRequest, res) => {
    const result = await createPlaidLinkToken(req.userId!);
    res.json(result);
  });

  router.post("/plaid/exchange", requireAuth, async (req: AuthedRequest, res) => {
    const publicToken = String(req.body?.publicToken || "");
    if (!publicToken) {
      res.status(400).json({ error: "publicToken is required" });
      return;
    }
    const { accessToken, itemId } = await exchangePlaidPublicToken(publicToken);
    const account = await LinkedAccountModel.create({
      userId: req.userId,
      plaidItemId: itemId,
      plaidAccountId: String(req.body?.accountId || `acc_${Date.now()}`),
      accessToken,
      institutionName: String(req.body?.institutionName || "Plaid Bank"),
      accountName: String(req.body?.accountName || "Checking"),
      mask: String(req.body?.mask || "1234"),
    });
    res.status(201).json({
      id: String(account._id),
      plaidItemId: account.plaidItemId,
      plaidAccountId: account.plaidAccountId,
      institutionName: account.institutionName,
      accountName: account.accountName,
      mask: account.mask,
      createdAt: account.createdAt,
    });
  });

  router.get("/plaid/accounts", requireAuth, async (req: AuthedRequest, res) => {
    const accounts = await LinkedAccountModel.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(
      accounts.map((a) => ({
        id: String(a._id),
        plaidItemId: a.plaidItemId,
        plaidAccountId: a.plaidAccountId,
        institutionName: a.institutionName,
        accountName: a.accountName,
        mask: a.mask,
        createdAt: a.createdAt,
      })),
    );
  });

  router.delete("/plaid/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    await LinkedAccountModel.deleteOne({ _id: req.params.id, userId: req.userId });
    res.status(204).send();
  });

  router.post("/plaid/sync", requireAuth, async (req: AuthedRequest, res) => {
    const result = await syncUserRoundUps(req.userId!);
    res.json(result);
  });

  // Round-Ups & Alpaca Investing
  router.get("/roundup/summary", requireAuth, async (req: AuthedRequest, res) => {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [txns, entries] = await Promise.all([
      RoundUpTransactionModel.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(15),
      LedgerEntryModel.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(10),
    ]);
    res.json({
      balanceCents: user.roundUpBalanceCents,
      thresholdCents: ROUNDUP_THRESHOLD_CENTS,
      roundUpEnabled: user.roundUpEnabled,
      selectedBasketId: user.selectedBasketId,
      recentTransactions: txns.map((t) => ({
        id: String(t._id),
        plaidTransactionId: t.plaidTransactionId,
        merchantName: t.merchantName,
        amountCents: t.amountCents,
        roundUpCents: t.roundUpCents,
        date: t.date,
      })),
      ledgerEntries: entries.map((e) => ({
        id: String(e._id),
        idempotencyKey: e.idempotencyKey,
        status: e.status,
        amountCents: e.amountCents,
        basketId: e.basketId,
        brokerOrderIds: e.brokerOrderIds,
        createdAt: e.createdAt,
      })),
    });
  });

  router.patch("/roundup/settings", requireAuth, async (req: AuthedRequest, res) => {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (typeof req.body?.roundUpEnabled === "boolean") {
      user.roundUpEnabled = req.body.roundUpEnabled;
    }
    if (typeof req.body?.selectedBasketId === "string") {
      user.selectedBasketId = req.body.selectedBasketId;
    }
    await user.save();
    res.json({ user: toPublicUser(user) });
  });

  router.post("/roundup/flush", requireAuth, async (req: AuthedRequest, res) => {
    const result = await flushUserRoundUps(req.userId!);
    res.json(result);
  });

  router.get("/portfolio/positions", requireAuth, async (_req, res) => {
    const positions = await getPortfolioPositions();
    res.json(positions);
  });

  return router;
}
