import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { detectServerLocale, extractUserMetadata } from "../locale-detection";
import { logger } from "../logger";
import { FeedbackModel } from "../models";

export class CommonController {
  getLocale = asyncHandler(async (req: Request, res: Response) => {
    try {
      const userMetadata = extractUserMetadata(req.headers);
      const ipAddress = req.ip || req.connection.remoteAddress;

      const locale = await detectServerLocale(userMetadata, ipAddress);

      res.json({
        locale,
        detectedFrom: "server",
        metadata: {
          ipAddress: ipAddress?.replace(/^::ffff:/, ""), // Remove IPv6 prefix
          browserLanguage: userMetadata.browserLanguage,
        },
      });
    } catch (error) {
      logger.warn("Locale detection failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.json({
        locale: "en-US",
        detectedFrom: "fallback",
        error: "Detection failed",
      });
    }
  });

  logError = (req: Request, res: Response) => {
    const { message, stack, componentStack, url, userAgent, userId, extra } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    logger.error(`[CLIENT] ${message}`, {
      source: "client",
      stack,
      componentStack,
      url,
      userAgent,
      userId,
      ...extra,
    });

    res.json({ logged: true });
  };

  logWarning = (req: Request, res: Response) => {
    const { message, url, userId, extra } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    logger.warn(`[CLIENT] ${message}`, {
      source: "client",
      url,
      userId,
      ...extra,
    });

    res.json({ logged: true });
  };

  /**
   * Proxy for Nominatim Address Search (solves CORS issues and adds rate limiting)
   */
  searchAddress = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Search query 'q' is required" });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      // Nominatim requires a descriptive User-Agent
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        {
          headers: {
            "User-Agent": "BerryBankGreenHub/1.0",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.status === 503) {
        res.status(503).json({ error: "Search service temporarily unavailable (rate limited)" });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn("Address search proxy timed out");
        res.status(504).json({ error: "Address search service timed out" });
      } else {
        logger.error("Address search proxy failed", { error: String(error) });
        res.status(500).json({ error: "Failed to fetch address suggestions" });
      }
    }
  });

  /**
   * Submit user feedback. Saved to MongoDB.
   * TODO: Consider integrating Zapier or SendGrid to notify team (e.g. contact@berrybank.app).
   */
  submitFeedback = asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body;
    const userId = (req as { user?: { id: string; username: string } }).user?.id;
    const username =
      (req as { user?: { id: string; username: string } }).user?.username ?? "anonymous";

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const doc = await FeedbackModel.create({
      userId,
      username,
      message,
    });

    logger.info("Feedback saved to database", {
      feedbackId: doc._id.toString(),
      userId,
      username,
      messageLength: message?.length ?? 0,
    });

    res.status(201).json({ success: true, message: "Thank you for your feedback!" });
  });

  /**
   * Proxy for Nominatim Reverse Geocoding
   */
  reverseGeocode = asyncHandler(async (req: Request, res: Response) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      res.status(400).json({ error: "lat and lon are required" });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            "User-Agent": "BerryBankGreenHub/1.0",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.status === 503) {
        res.status(503).json({ error: "Geocoding service temporarily unavailable" });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn("Reverse geocoding proxy timed out");
        res.status(504).json({ error: "Reverse geocoding service timed out" });
      } else {
        logger.error("Reverse geocoding proxy failed", { error: String(error) });
        res.status(500).json({ error: "Failed to fetch address from coordinates" });
      }
    }
  });

  /**
   * Get public application configuration (feature flags, etc.)
   */
  getConfig = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      stripeDisabled: process.env.STRIPE_DISABLED === "true",
    });
  });
}

export const commonController = new CommonController();
