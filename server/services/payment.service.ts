import Stripe from "stripe";
import { storage } from "../mongo/storage";
import { projectService } from "./project.service";
import { processRefreshedTransactions } from "./roundup.service";
import { logger } from "../logger";

// Initialize Stripe lazily
let stripeInstance: Stripe;

const getStripe = () => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
};

/** Get or create Stripe Customer for Financial Connections (bank linking) */
async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    phone: user.phoneNumber,
    metadata: { userId },
  });
  await storage.setStripeCustomerId(userId, customer.id);
  return customer.id;
}

export class PaymentService {
  async createStripeSession(data: {
    projectId: string;
    amount: number;
    userId: string;
    origin: string;
  }): Promise<string> {
    if (process.env.STRIPE_DISABLED === "true") {
      throw new Error("Payments are currently disabled");
    }
    const project = await storage.getProject(data.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Support: ${project.title}`,
              description: `Contribution to ${project.title} environmental project`,
              images: [project.imageUrl],
            },
            unit_amount: Math.round(data.amount * 100), // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${data.origin}/project/${data.projectId}?success=true`,
      cancel_url: `${data.origin}/project/${data.projectId}?canceled=true`,
      metadata: {
        projectId: data.projectId,
        userId: data.userId || "anonymous",
      },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session URL");
    }

    logger.info("Stripe session created", {
      projectId: data.projectId,
      userId: data.userId,
      sessionId: session.id,
    });

    return session.url;
  }

  /**
   * Create a Financial Connections session for bank linking.
   * Returns client_secret for use with Stripe.js on the frontend.
   */
  async createFinancialConnectionsSession(userId: string, returnUrl: string): Promise<string> {
    const customerId = await getOrCreateStripeCustomer(userId);
    const session = await getStripe().financialConnections.sessions.create({
      account_holder: { type: "customer", customer: customerId },
      permissions: ["transactions", "payment_method"],
      prefetch: ["transactions"],
      return_url: returnUrl,
    });
    if (!session.client_secret) throw new Error("Failed to create Financial Connections session");
    logger.info("Financial Connections session created", { userId, sessionId: session.id });
    return session.client_secret;
  }

  /**
   * Handle Stripe webhook events. Updates project funding and records contributions
   * when checkout.session.completed is received.
   * Handles financial_connections.account.created and refreshed_transactions for round-up.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (process.env.STRIPE_DISABLED === "true") {
      logger.warn("Received Stripe webhook but payments are disabled; skipping");
      return;
    }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // TODO: Add STRIPE_WEBHOOK_SECRET to env (GCP Secret Manager for prod/sandbox).
      // For local testing: stripe listen --forward-to localhost:8000/api/stripe/webhook
      logger.warn("STRIPE_WEBHOOK_SECRET not set; webhook signature verification skipped");
      throw new Error("Webhook secret not configured");
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature!, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error("Stripe webhook signature verification failed", { error: msg });
      throw err;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectId = session.metadata?.projectId;
      const userId = session.metadata?.userId;
      const amountTotal = session.amount_total; // cents, or null for some session types

      if (!projectId) {
        logger.warn("checkout.session.completed missing projectId in metadata", {
          sessionId: session.id,
        });
        return;
      }

      const amountDollars = amountTotal != null ? amountTotal / 100 : 0;
      if (amountDollars <= 0) {
        logger.warn("checkout.session.completed has no amount", { sessionId: session.id });
        return;
      }

      // userId may be "anonymous" for guests
      const effectiveUserId = userId && userId !== "anonymous" ? userId : undefined;

      await projectService.processFunding(projectId, amountDollars, effectiveUserId);
      logger.info("Webhook: processed funding from checkout.session.completed", {
        projectId,
        amount: amountDollars,
        userId: effectiveUserId ?? "anonymous",
      });
    }

    if (event.type === "financial_connections.account.created") {
      const account = event.data.object as Stripe.FinancialConnections.Account;
      const holder = account.account_holder;
      const customerId =
        holder && typeof holder === "object" && "customer" in holder
          ? typeof holder.customer === "string"
            ? holder.customer
            : holder.customer?.id
          : null;
      if (!customerId) {
        logger.warn("financial_connections.account.created missing customer");
        return;
      }
      const user = await storage.getUserByStripeCustomerId(customerId);
      if (!user) {
        logger.warn("financial_connections.account.created: no user for customer", { customerId });
        return;
      }
      const existing = await storage.getLinkedBankAccountByStripeId(account.id);
      if (!existing) {
        await storage.createLinkedBankAccount({
          userId: user.id,
          stripeAccountId: account.id,
          displayName: account.display_name ?? undefined,
          institutionName: account.institution_name ?? undefined,
          last4: account.last4 ?? undefined,
        });
        logger.info("Linked bank account created", { userId: user.id, accountId: account.id });
      }
      // Subscribe to transactions for this account
      try {
        await getStripe().financialConnections.accounts.subscribe(account.id, {
          features: ["transactions"],
        });
      } catch (err) {
        logger.warn("Failed to subscribe to transactions", {
          accountId: account.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (event.type === "financial_connections.account.refreshed_transactions") {
      const account = event.data.object as Stripe.FinancialConnections.Account;
      const refreshId = account.transaction_refresh?.id;
      await processRefreshedTransactions(account.id, refreshId);
    }
  }
}

export const paymentService = new PaymentService();
