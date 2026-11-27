import express, { type Request, Response, NextFunction } from "express";

/** Extended Request for Stripe webhook - raw body needed for signature verification */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { corsMiddleware } from "./cors";
import { logger } from "./logger";
import { log } from "./vite";

const app = express();

/**
 * 🛡️ SECURITY PILLAR: Trust Proxy
 * Cloud Run and other load balancers use proxies.
 * This ensures req.ip correctly identifies the client, not the proxy.
 */
app.set("trust proxy", 1);

// 🛡️ SECURITY PILLAR: Fundamental headers for XSS, Clickjacking, and more
app.use(
  helmet({
    referrerPolicy: { policy: "no-referrer-when-downgrade" },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"], // Stripe.js
        "frame-src": ["'self'", "https://js.stripe.com"], // Stripe Financial Connections / hosted forms
        "worker-src": ["'self'", "blob:"], // Required for Vite/Leaflet web workers
        "connect-src": [
          "'self'",
          "ws://localhost:24680", // Vite HMR
          "ws://127.0.0.1:24680", // Vite HMR (Playwright often uses this)
          "ws://localhost:8000", // App WebSockets
          "https://nominatim.openstreetmap.org", // Geocoding
          "https://ipapi.co", // IP-based geolocation
          "https://api.stripe.com", // Stripe API
          "https://*.storage.googleapis.com", // GCS Uploads
          "*.run.app", // Cloud Run services
        ],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https://*.tile.openstreetmap.org", // Leaflet maps
          "https://*.basemaps.cartocdn.com", // CartoDB maps
          "https://unpkg.com", // Leaflet markers/assets
          "https://images.unsplash.com", // Demo images
          "https://*.storage.googleapis.com", // GCS images
          "https://cdn.example.com", // CDN assets
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

// 🛡️ SECURITY PILLAR: Basic rate limiting to prevent brute-force/DoS
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again after 15 minutes" },
  // Validates that the proxy is trusted and headers are handled
  validate: { trustProxy: true },
  // 🛡️ PERFORMANCE PILLAR: Skip rate limiting for automated tests and CI
  // Unless explicitly requested via x-test-rate-limit header
  skip: (req) => {
    if (req.get("x-test-rate-limit") === "true") return false;
    const isPlaywright = req.get("x-playwright-test") === "true";
    return isPlaywright || process.env.NODE_ENV === "test" || !!process.env.CI;
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Strict limit for auth routes: 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again after 15 minutes" },
  validate: false,
  keyGenerator: (req) => {
    const testKey = req.get("x-test-rate-limit-key");
    if (testKey) return `test-${testKey}`;
    return req.ip || "unknown-ip";
  },
  skip: (req) => {
    if (req.get("x-test-rate-limit") === "true") return false;
    const isPlaywright = req.get("x-playwright-test") === "true";
    return isPlaywright || process.env.NODE_ENV === "test" || !!process.env.CI;
  },
});

// CORS must be applied before other middleware for preflight requests
app.use(corsMiddleware);

// Store raw body for Stripe webhook (signature verification requires unparsed body)
app.use(
  express.json({
    verify: (req, _res, buf, _encoding) => {
      // req is IncomingMessage at this stage; originalUrl exists on Express Request
      const url = (req as Request).originalUrl ?? (req as { url?: string }).url;
      if (url === "/api/stripe/webhook") {
        (req as RequestWithRawBody).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 🛡️ SECURITY PILLAR: NoSQL Injection Protection
// express-mongo-sanitize's default middleware is incompatible with Express 5
// because it reassigns req.query, which is a read-only getter in Express 5.
// Calling sanitize() directly mutates objects in-place without reassignment.
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.headers) mongoSanitize.sanitize(req.headers);
  if (req.query) mongoSanitize.sanitize(req.query as Record<string, unknown>);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Never log tokens or passwords — redact for auth-related endpoints
        const sensitivePaths = ["/api/login", "/api/register", "/api/register-entity", "/api/user"];
        let toLog = capturedJsonResponse;
        if (sensitivePaths.some((p) => (p === "/api/user" ? path === p : path.startsWith(p)))) {
          toLog = { ...capturedJsonResponse };
          if (toLog && typeof toLog === "object") {
            if ("token" in toLog) (toLog as Record<string, unknown>).token = "[REDACTED]";
            if ("user" in toLog) {
              const u = (toLog as Record<string, unknown>).user;
              if (u && typeof u === "object" && "password" in u) {
                (u as Record<string, unknown>).password = "[REDACTED]";
              }
            }
          }
        }
        logLine += ` :: ${JSON.stringify(toLog)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handling middleware
export const errorHandler = (
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error with structured logging for GCP Error Reporting
  logger.error(message, {
    status,
    method: req.method,
    path: req.path,
    stack: err.stack,
    name: err.name,
  });

  res.status(status).json({ message });
};

export default app;
