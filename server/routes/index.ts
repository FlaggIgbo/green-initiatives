import type { Express } from "express";
import { createServer, type Server } from "http";
import { protect, optionalProtect, authorize } from "../middleware/auth.middleware";
import { environmentMiddleware, type RequestWithEnvironment } from "../environment";
import { apiLimiter, authLimiter } from "../app";
import { projectController } from "../controllers/project.controller";
import { commentController } from "../controllers/comment.controller";
import { organizationController } from "../controllers/organization.controller";
import { userController } from "../controllers/user.controller";
import { commonController } from "../controllers/common.controller";
import { stripeController } from "../controllers/stripe.controller";
import { roundupController } from "../controllers/roundup.controller";
import { validateRequest } from "../middleware/validation.middleware";
import {
  registerSchema,
  registerEntitySchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";
import {
  createProjectSchema,
  updateApprovalStatusSchema,
  fundProjectSchema,
} from "../schemas/project.schema";
import { createCommentSchema, flagCommentSchema } from "../schemas/comment.schema";
import { submitFeedbackSchema } from "../schemas/feedback.schema";
import { USER_ROLES } from "@shared/schema-mongo";

export async function registerRoutes(app: Express): Promise<Server> {
  // Root endpoint - Server status (only in production, Vite handles / in dev)
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "sandbox") {
    app.get("/", (_req, res) => {
      res.status(200).json({
        service: "GreenInitiatives API",
        status: "running",
        version: process.env.APP_VERSION || "v1.1.1",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/health",
          api: "/api/*",
          docs: "https://github.com/BerryBank/BerryBankGreenHub",
        },
      });
    });
  }

  // Health check endpoint for GCP Cloud Run
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Apply environment detection middleware to all routes
  app.use(environmentMiddleware);

  // 🛡️ SECURITY PILLAR: Rate Limiting
  // General limit for all API traffic
  app.use("/api", apiLimiter);
  // Stricter limit for sensitive authentication routes
  app.use(["/api/register", "/api/register-entity", "/api/login", "/api/auth"], authLimiter);

  // Auth routes handled by UserController
  app.post("/api/register", validateRequest(registerSchema), userController.register);
  app.post(
    "/api/register-entity",
    validateRequest(registerEntitySchema),
    userController.registerEntity,
  );
  app.post("/api/login", validateRequest(loginSchema), userController.login);
  app.post("/api/logout", protect, userController.logout);
  app.post(
    "/api/auth/forgot-password",
    validateRequest(forgotPasswordSchema),
    userController.forgotPassword,
  );
  app.post(
    "/api/auth/reset-password",
    validateRequest(resetPasswordSchema),
    userController.resetPassword,
  );
  app.post("/api/auth/verify-otp", userController.verifyOTP);
  app.post("/api/auth/resend-otp", userController.resendOTP);
  app.get("/api/user", optionalProtect, userController.getCurrentUser);

  /**
   * 🔐 TODO: FUTURE AUTHENTICATION PILLARS for MFA and OAuth
   * 1. Authentication: Verifying identity (MFA, OAuth)
   * 2. Authorization: RBAC (Role-based access control)
   * 3. Security: Protecting resources (Headers, Validation, Hashing)
   */

  // 1. Authentication Pillar: MFA / OTP Setup & Verification
  app.post("/api/auth/mfa/setup", protect, (_req, res) => {
    // Blueprint: Generate TOTP secret (using 'speakeasy') and QR code
    res.status(501).json({
      pillar: "Authentication",
      feature: "MFA Setup",
      blueprint: "Generate TOTP secret and return QR code URI",
    });
  });

  app.post("/api/auth/mfa/verify", (_req, res) => {
    // Blueprint: Verify 6-digit OTP code against user's stored secret
    res.status(501).json({
      pillar: "Authentication",
      feature: "MFA Verification",
      blueprint: "Check 6-digit code via OTP library",
    });
  });

  // 1. Authentication Pillar: OAuth Social Logins
  app.get("/api/auth/google", (_req, res) => {
    // Blueprint: Redirect to Google OAuth Consent Screen
    res.status(501).json({
      pillar: "Authentication",
      feature: "OAuth Google",
      blueprint: "Redirect to accounts.google.com/o/oauth2/v2/auth",
    });
  });

  app.get("/api/auth/github", (_req, res) => {
    // Blueprint: Redirect to GitHub OAuth Consent Screen
    res.status(501).json({
      pillar: "Authentication",
      feature: "OAuth GitHub",
      blueprint: "Redirect to github.com/login/oauth/authorize",
    });
  });

  app.get("/api/auth/callback", (_req, res) => {
    // Blueprint: Exchange code for access token and upsert user in MongoDB
    res.status(501).json({
      pillar: "Authentication",
      feature: "OAuth Callback",
      blueprint: "Token exchange + User normalization",
    });
  });

  /**
   * 2. Authorization Pillar: RBAC
   * Note: This is already implemented via the 'authorize(...roles)'
   * middleware used in the routes below.
   */

  /**
   * 3. Security Pillar: Best Practices
   * - Hashing: Handled by Mongoose pre-save hook using bcryptjs.
   * - Headers: Handled by 'helmet' in server/app.ts.
   * - Validation: Handled by 'zod' schemas in routes below.
   * - Rate Limiting: Handled by 'express-rate-limit' in server/app.ts.
   * - CSRF: Protected via CORS origins and SameSite cookie settings.
   */

  // Environment detection endpoint
  app.get("/api/environment", protect, (req: RequestWithEnvironment, res) => {
    res.json({
      environment: req.environment,
      host: req.get("host"),
    });
  });

  // Locale detection endpoint, no protection needed
  app.get("/api/locale", commonController.getLocale);

  // App configuration (feature flags), no protection needed
  app.get("/api/config", commonController.getConfig);

  // Map and Geocoding Proxies
  app.get("/api/map/search", commonController.searchAddress);
  app.get("/api/map/reverse", commonController.reverseGeocode);

  // Organizations
  app.get("/api/organizations", protect, organizationController.getOrganizations);
  app.post(
    "/api/organizations",
    protect,
    authorize(USER_ROLES.entity, USER_ROLES.admin),
    organizationController.createOrganization,
  );

  // Projects
  app.get("/api/projects", optionalProtect, projectController.getProjects);
  app.get("/api/projects/search", optionalProtect, projectController.searchProjects);
  app.get("/api/projects/:id", optionalProtect, projectController.getProject);
  app.get(
    "/api/projects/:id/vetting-scorecard",
    protect,
    authorize(USER_ROLES.admin),
    projectController.getVettingScorecard,
  );
  app.get("/api/my-projects", protect, projectController.getMyProjects);
  app.post(
    "/api/projects",
    protect,
    authorize(USER_ROLES.entity, USER_ROLES.admin),
    validateRequest(createProjectSchema),
    projectController.createProject,
  );
  app.patch("/api/projects/:id", protect, projectController.updateProject);
  app.patch(
    "/api/projects/:id/approval",
    protect,
    authorize(USER_ROLES.admin),
    validateRequest(updateApprovalStatusSchema),
    projectController.updateApprovalStatus,
  );
  app.patch("/api/projects/:id/progress", protect, projectController.updateProgress);
  app.post(
    "/api/projects/:id/fund",
    protect,
    validateRequest(fundProjectSchema),
    projectController.fundProject,
  );
  app.post("/api/projects/upload-url", protect, projectController.getUploadUrl);
  app.post("/api/projects/verify-impact", protect, projectController.verifyImpactTracking);

  // User profile and tree
  app.get("/api/user/contributions", protect, userController.getContributions);
  app.post("/api/user/water-tree", protect, userController.waterTree);
  app.patch("/api/user/roundup-settings", protect, userController.updateRoundUpSettings);
  app.patch("/api/user/preferred-currency", protect, userController.updatePreferredCurrency);

  // Round-up / Bank linking (Plaid Link + legacy Financial Connections)
  app.post("/api/roundup/link-bank", protect, roundupController.createLinkSession);
  app.post("/api/roundup/link-bank-mock", protect, roundupController.createMockLink);
  app.post("/api/roundup/plaid/link-token", protect, roundupController.createPlaidLinkToken);
  app.post(
    "/api/roundup/plaid/exchange-token",
    protect,
    roundupController.exchangePlaidPublicToken,
  );
  app.post("/api/plaid/webhook", roundupController.handlePlaidWebhook);
  app.get("/api/roundup/linked-accounts", protect, roundupController.getLinkedAccounts);
  app.get("/api/roundup/recent-transactions", protect, roundupController.getRecentTransactions);
  app.get("/api/roundup/summary", protect, roundupController.getRoundUpSummary);
  app.delete("/api/roundup/linked-accounts/:id", protect, roundupController.unlinkAccount);

  // TODO: ESG Investing (Alpaca), Screener & Natural-Language Rebalancer endpoints
  app.get("/api/portfolio/positions", protect, (_req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      todo: "Call alpacaService.getPortfolioPositions(req.user.id)",
    });
  });
  app.get("/api/portfolio/tax-lots.csv", protect, (_req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      todo: "Call alpacaService.exportTaxLotsCsv(req.user.id, taxYear)",
    });
  });
  app.get("/api/esg/baskets/:basketId/alerts", protect, (_req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      todo: "Call esgAgentService.auditBasketHoldings(basketId)",
    });
  });
  app.post("/api/esg/rebalance", protect, (_req, res) => {
    res.status(501).json({
      error: "Not Implemented",
      todo: "Call esgAgentService.translateNaturalLanguageRebalance(req.user.id, req.body.prompt)",
    });
  });

  // Cron: Flush round-up balances (Cloud Scheduler, secured by ROUNDUP_CRON_SECRET)
  app.post("/api/cron/flush-roundups", roundupController.flushRoundUpsCron);

  // Comments
  app.get("/api/projects/:id/comments", protect, commentController.getProjectComments);
  app.post(
    "/api/projects/:id/comments",
    protect,
    validateRequest(createCommentSchema),
    commentController.createComment,
  );
  app.patch("/api/comments/:id", protect, commentController.updateComment);
  app.delete("/api/comments/:id", protect, commentController.deleteComment);
  app.patch("/api/comments/:id/like", protect, commentController.toggleLike);
  app.patch(
    "/api/comments/:id/flag",
    protect,
    validateRequest(flagCommentSchema),
    commentController.flagComment,
  );

  // Admin Comments
  app.get(
    "/api/admin/comments/flagged",
    protect,
    authorize(USER_ROLES.admin),
    commentController.getFlaggedComments,
  );
  app.post(
    "/api/admin/comments/:id/moderate",
    protect,
    authorize(USER_ROLES.admin),
    commentController.moderateComment,
  );

  // Feedback (saved to MongoDB)
  app.post(
    "/api/feedback",
    protect,
    validateRequest(submitFeedbackSchema),
    commonController.submitFeedback,
  );

  // Client logging
  app.post("/api/log/error", commonController.logError);
  app.post("/api/log/warn", commonController.logWarning);

  // Stripe Payments
  app.post("/api/stripe/create-checkout-session", protect, stripeController.createCheckoutSession);
  // Webhook: no auth - Stripe signs payload. Raw body required (see app.ts express.json verify)
  app.post("/api/stripe/webhook", stripeController.handleWebhook);

  const httpServer = createServer(app);
  return httpServer;
}
