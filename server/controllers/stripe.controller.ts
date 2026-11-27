import { Request, Response } from "express";
import asyncHandler from "express-async-handler";

/** Request with rawBody (set by express.json verify for webhook route) */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export class StripeController {
  createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
    /* Temporarily disabled
    const { projectId, amount } = req.body;

    if (!projectId || !amount || isNaN(amount)) {
      res.status(400).json({ error: "Project ID and valid amount are required" });
      return;
    }

    try {
      const url = await paymentService.createStripeSession({
        projectId,
        amount,
        userId: req.user?.id || "anonymous",
        origin: req.get("origin") || "",
      });

      res.json({ url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message === "Project not found") {
        res.status(404).json({ error: message });
        return;
      }

      logger.error("Stripe session creation failed", { error: message });
      res.status(500).json({ error: message });
    }
    */
    res.status(503).json({ error: "Stripe service is temporarily unavailable" });
  });

  /**
   * Stripe webhook handler. Must receive raw body for signature verification.
   * No auth middleware - Stripe signs the payload.
   */
  handleWebhook = asyncHandler(async (req: RequestWithRawBody, res: Response) => {
    /* Temporarily disabled
    const rawBody = req.rawBody;
    const signature = req.headers["stripe-signature"] as string | undefined;

    if (!rawBody) {
      logger.error("Webhook received without raw body (ensure express.json verify stores it)");
      res.status(400).json({ error: "Missing raw body" });
      return;
    }

    try {
      await paymentService.handleWebhook(rawBody, signature);
      res.status(200).json({ received: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error("Stripe webhook processing failed", { error: msg });
      res.status(400).json({ error: msg });
    }
    */
    res.status(503).json({ error: "Stripe service is temporarily unavailable" });
  });
}

export const stripeController = new StripeController();
