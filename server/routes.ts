import { Router, type Request } from "express";
import {
  clearSessionCookie,
  getSessionUserId,
  hashPassword,
  requireAuth,
  setSessionCookie,
  signMfaToken,
  verifyMfaTokenPayload,
  verifyPassword,
  type AuthedRequest,
  type MfaTokenPayload,
} from "./auth";
import { LedgerEntryModel, LinkedAccountModel, RoundUpTransactionModel, UserModel } from "./models";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "./services/plaid.service";
import { ESG_BASKETS, getPortfolioPositions } from "./services/alpaca.service";
import {
  flushUserRoundUps,
  ROUNDUP_THRESHOLD_CENTS,
  syncUserRoundUps,
} from "./services/roundup.service";
import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  CHALLENGE_TTL_MS,
  generateChallenge,
  resolveRpConfig,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
  type AuthenticationVerificationInput,
  type RegistrationVerificationInput,
} from "./services/webauthn.service";
import {
  isMfaTokenJtiRevoked,
  issueEmailOtp,
  revokeMfaTokenJti,
  verifyStoredEmailOtp,
} from "./services/otp.service";
import type { AuthStepResponse, OtpSendResponse, PasskeySummary, PublicUser } from "@shared/types";

function toPublicUser(doc: {
  _id: unknown;
  email: string;
  roundUpEnabled: boolean;
  selectedBasketId: string;
  roundUpBalanceCents: number;
  passkeys?: Array<unknown>;
}): PublicUser {
  return {
    id: String(doc._id),
    email: doc.email,
    roundUpEnabled: doc.roundUpEnabled,
    selectedBasketId: doc.selectedBasketId,
    roundUpBalanceCents: doc.roundUpBalanceCents,
    passkeysCount: doc.passkeys?.length ?? 0,
  };
}

async function resolveActiveMfa(req: Request): Promise<MfaTokenPayload | null> {
  const mfaToken = typeof req.body?.mfaToken === "string" ? req.body.mfaToken : "";
  if (!mfaToken) return null;
  const payload = verifyMfaTokenPayload(mfaToken);
  if (!payload) return null;
  if (await isMfaTokenJtiRevoked(payload.jti)) return null;
  return payload;
}

async function resolveMfaOrSession(
  req: Request,
): Promise<{ userId: string; mfa?: MfaTokenPayload } | null> {
  const mfa = await resolveActiveMfa(req);
  if (mfa) return { userId: mfa.userId, mfa };
  const sessionUserId = getSessionUserId(req);
  return sessionUserId ? { userId: sessionUserId } : null;
}

export function createApiRouter(): Router {
  const router = Router();

  // Auth — Step 1: Username / Password -> triggers Step 2 (Passkey or Email OTP fallback)
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
    const challenge = generateChallenge();
    const { rpId } = resolveRpConfig(req.headers);
    const user = await UserModel.create({
      email,
      passwordHash: hashPassword(password),
      pendingChallenge: {
        challenge,
        type: "registration",
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    const response: AuthStepResponse = {
      status: "mfa_required",
      mfaToken: signMfaToken(String(user._id)),
      email: user.email,
      hasPasskey: false,
      passkeyRegistrationOptions: buildRegistrationOptions({
        userId: String(user._id),
        email: user.email,
        rpId,
        challenge,
      }),
    };
    res.status(201).json(response);
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

    const challenge = generateChallenge();
    const { rpId } = resolveRpConfig(req.headers);
    const hasPasskey = Array.isArray(user.passkeys) && user.passkeys.length > 0;
    user.pendingChallenge = {
      challenge,
      type: hasPasskey ? "authentication" : "registration",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    };
    await user.save();

    const response: AuthStepResponse = {
      status: "mfa_required",
      mfaToken: signMfaToken(String(user._id)),
      email: user.email,
      hasPasskey,
      ...(hasPasskey
        ? {
            passkeyOptions: buildAuthenticationOptions({
              rpId,
              challenge,
              passkeys: user.passkeys.map(
                (pk: { credentialId: string; transports?: string[] }) => ({
                  credentialId: pk.credentialId,
                  transports: pk.transports,
                }),
              ),
            }),
          }
        : {
            passkeyRegistrationOptions: buildRegistrationOptions({
              userId: String(user._id),
              email: user.email,
              rpId,
              challenge,
            }),
          }),
    };
    res.json(response);
  });

  // Auth — Step 2a: WebAuthn Passkey Registration & Authentication
  router.post("/auth/passkey/register/options", async (req, res) => {
    const authCtx = await resolveMfaOrSession(req);
    if (!authCtx) {
      res.status(401).json({ error: "Unauthorized or expired MFA session" });
      return;
    }
    const user = await UserModel.findById(authCtx.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const challenge = generateChallenge();
    const { rpId } = resolveRpConfig(req.headers);
    user.pendingChallenge = {
      challenge,
      type: "registration",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    };
    await user.save();
    res.json({
      options: buildRegistrationOptions({
        userId: String(user._id),
        email: user.email,
        rpId,
        challenge,
        existingCredentialIds: (user.passkeys || []).map(
          (pk: { credentialId: string }) => pk.credentialId,
        ),
      }),
    });
  });

  router.post("/auth/passkey/register/verify", async (req, res) => {
    const authCtx = await resolveMfaOrSession(req);
    if (!authCtx) {
      res.status(401).json({ error: "Unauthorized or expired MFA session" });
      return;
    }
    const user = await UserModel.findById(authCtx.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const pending = user.pendingChallenge;
    if (
      !pending?.challenge ||
      pending.type !== "registration" ||
      !pending.expiresAt ||
      pending.expiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ error: "Passkey registration challenge expired; please retry" });
      return;
    }
    const { rpId, origin } = resolveRpConfig(req.headers);
    try {
      const stored = verifyPasskeyRegistration(
        req.body?.credential as RegistrationVerificationInput,
        pending.challenge,
        origin,
        rpId,
      );
      if (authCtx.mfa) {
        const revoked = await revokeMfaTokenJti(authCtx.mfa.jti, authCtx.mfa.exp);
        if (!revoked) {
          res.status(401).json({ error: "MFA session has already been used" });
          return;
        }
      }
      const duplicate = (user.passkeys || []).some(
        (pk: { credentialId: string }) => pk.credentialId === stored.credentialId,
      );
      if (!duplicate) {
        user.passkeys.push({
          ...stored,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        });
      }
      user.pendingChallenge = undefined;
      await user.save();
      setSessionCookie(res, String(user._id));
      const response: AuthStepResponse = { status: "authenticated", user: toPublicUser(user) };
      res.json(response);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Passkey registration verification failed",
      });
    }
  });

  router.post("/auth/passkey/login/options", async (req, res) => {
    const mfa = await resolveActiveMfa(req);
    if (!mfa) {
      res.status(401).json({ error: "Invalid or expired MFA session" });
      return;
    }
    const user = await UserModel.findById(mfa.userId);
    if (!user || !user.passkeys?.length) {
      res.status(400).json({ error: "No passkeys registered for this account" });
      return;
    }
    const challenge = generateChallenge();
    const { rpId } = resolveRpConfig(req.headers);
    user.pendingChallenge = {
      challenge,
      type: "authentication",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    };
    await user.save();
    res.json({
      options: buildAuthenticationOptions({
        rpId,
        challenge,
        passkeys: user.passkeys.map((pk: { credentialId: string; transports?: string[] }) => ({
          credentialId: pk.credentialId,
          transports: pk.transports,
        })),
      }),
    });
  });

  router.post("/auth/passkey/login/verify", async (req, res) => {
    const mfa = await resolveActiveMfa(req);
    if (!mfa) {
      res.status(401).json({ error: "Invalid or expired MFA session" });
      return;
    }
    const user = await UserModel.findById(mfa.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const pending = user.pendingChallenge;
    if (
      !pending?.challenge ||
      pending.type !== "authentication" ||
      !pending.expiresAt ||
      pending.expiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ error: "Passkey authentication challenge expired; please retry" });
      return;
    }
    const assertion = req.body?.credential as AuthenticationVerificationInput | undefined;
    const credId = assertion?.id || assertion?.rawId;
    const passkey = (user.passkeys || []).find(
      (pk: { credentialId: string }) => pk.credentialId === credId,
    );
    if (!assertion || !passkey) {
      res.status(401).json({ error: "Unrecognized passkey credential" });
      return;
    }
    const { rpId, origin } = resolveRpConfig(req.headers);
    try {
      const { newSignCount } = verifyPasskeyAuthentication(
        assertion,
        passkey,
        pending.challenge,
        origin,
        rpId,
      );
      const revoked = await revokeMfaTokenJti(mfa.jti, mfa.exp);
      if (!revoked) {
        res.status(401).json({ error: "MFA session has already been used" });
        return;
      }
      passkey.signCount = newSignCount;
      passkey.lastUsedAt = new Date();
      user.pendingChallenge = undefined;
      await user.save();
      setSessionCookie(res, String(user._id));
      const response: AuthStepResponse = { status: "authenticated", user: toPublicUser(user) };
      res.json(response);
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : "Passkey verification failed",
      });
    }
  });

  // Auth — Step 2b: Email OTP Fallback via Nodemailer SMTP + Redis TTL Cache
  router.post("/auth/otp/send", async (req, res) => {
    const mfa = await resolveActiveMfa(req);
    if (!mfa) {
      res.status(401).json({ error: "Invalid or expired MFA session" });
      return;
    }
    const user = await UserModel.findById(mfa.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    try {
      const issued = await issueEmailOtp(String(user._id), user.email, { ip: req.ip });
      if (!issued.ok) {
        res.setHeader("Retry-After", String(issued.retryAfterSeconds));
        res.status(issued.status).json({
          error: issued.error,
          retryAfterSeconds: issued.retryAfterSeconds,
        });
        return;
      }
      const response: OtpSendResponse = {
        sent: true,
        delivery: issued.delivery,
        expiresInSeconds: issued.expiresInSeconds,
        ...(issued.delivery === "console" && process.env.NODE_ENV !== "production"
          ? { devCode: issued.code }
          : {}),
      };
      res.json(response);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? `SMTP delivery failed: ${err.message}` : "SMTP delivery failed",
      });
    }
  });

  router.post("/auth/otp/verify", async (req, res) => {
    const mfa = await resolveActiveMfa(req);
    if (!mfa) {
      res.status(401).json({ error: "Invalid or expired MFA session" });
      return;
    }
    const code = String(req.body?.code || "").trim();
    const user = await UserModel.findById(mfa.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const result = await verifyStoredEmailOtp(String(user._id), code);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const revoked = await revokeMfaTokenJti(mfa.jti, mfa.exp);
    if (!revoked) {
      res.status(401).json({ error: "MFA session has already been used" });
      return;
    }

    user.pendingChallenge = undefined;
    await user.save();
    setSessionCookie(res, String(user._id));
    const response: AuthStepResponse = { status: "authenticated", user: toPublicUser(user) };
    res.json(response);
  });

  // Passkey management (authenticated)
  router.get("/auth/passkeys", requireAuth, async (req: AuthedRequest, res) => {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const list: PasskeySummary[] = (user.passkeys || []).map(
      (pk: {
        credentialId: string;
        label?: string;
        createdAt?: Date;
        lastUsedAt?: Date;
      }) => ({
        credentialId: pk.credentialId,
        label: pk.label || "Passkey",
        createdAt: pk.createdAt ? pk.createdAt.toISOString() : new Date().toISOString(),
        lastUsedAt: pk.lastUsedAt ? pk.lastUsedAt.toISOString() : undefined,
      }),
    );
    res.json(list);
  });

  router.delete("/auth/passkeys/:credentialId", requireAuth, async (req: AuthedRequest, res) => {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    user.passkeys = (user.passkeys || []).filter(
      (pk: { credentialId: string }) => pk.credentialId !== req.params.credentialId,
    );
    await user.save();
    res.status(204).send();
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

  // Charitable Giving, ACH, DAF & Tax Documents (Stubs)
  router.get("/charities", requireAuth, async (_req, res) => {
    // TODO: Wire to searchVerifiedCharities(req.query.q, req.query.category)
    res.status(501).json({ error: "Not implemented" });
  });

  router.patch("/giving/settings", requireAuth, async (_req: AuthedRequest, res) => {
    // TODO: Validate percentageBps, eligibleCategories, directCharitySplitPct + dafSplitPct === 100, and NACHA ACH consent
    res.status(501).json({ error: "Not implemented" });
  });

  router.post("/giving/flush", requireAuth, async (_req: AuthedRequest, res) => {
    // TODO: Wire to flushUserGiving(req.userId!)
    res.status(501).json({ error: "Not implemented" });
  });

  router.post("/webhooks/plaid-transfer", async (_req, res) => {
    // TODO: Wire to handleAchWebhook(rawBody, signatureHeader) to process ACH settlement/return events
    res.status(501).json({ error: "Not implemented" });
  });

  router.post("/daf/provision", requireAuth, async (_req: AuthedRequest, res) => {
    // TODO: Wire to provisionUserDafAccount(req.userId!)
    res.status(501).json({ error: "Not implemented" });
  });

  router.post("/daf/grant", requireAuth, async (_req: AuthedRequest, res) => {
    // TODO: Wire to recommendDafGrant({ userId, dafAccountId, charityEin, amountCents })
    res.status(501).json({ error: "Not implemented" });
  });

  router.get("/tax-docs/:year", requireAuth, async (_req: AuthedRequest, res) => {
    // TODO: Wire to generateTaxDocumentPacket(req.userId!, Number(req.params.year), format)
    res.status(501).json({ error: "Not implemented" });
  });

  return router;
}
