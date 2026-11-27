import cors from "cors";
import { logger } from "./logger";

/**
 * CORS Configuration for decoupled client/server deployment
 *
 * Allows requests from:
 * - localhost (development)
 * - Cloud Run client services (sandbox and production)
 * - Custom domains if configured
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  // Development
  "http://localhost:8080",
  "http://localhost:8000",
  "http://localhost:5173", // Vite dev server
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:5173",
];

// Pattern to match Cloud Run URLs (including region and .a.run.app)
const CLOUD_RUN_PATTERN =
  /^https:\/\/greeninitiatives-client-(sandbox|prod)-[a-z0-9-]+(\.[a-z0-9-]+)*\.run\.app$/;

// Additional allowed origins from environment variable (comma-separated)
const EXTRA_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow requests with no origin (same-origin, Postman, curl, etc.)
    return true;
  }

  // Check static allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check extra origins from env
  if (EXTRA_ORIGINS.includes(origin)) {
    return true;
  }

  // Check Cloud Run pattern
  if (CLOUD_RUN_PATTERN.test(origin)) {
    return true;
  }

  // Check for any .run.app domain in development/sandbox
  if (process.env.NODE_ENV !== "production") {
    if (origin.endsWith(".run.app")) {
      return true;
    }
  }

  return false;
}

/**
 * CORS middleware using the 'cors' package
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      // Returning null, false tells the cors package to NOT include CORS headers
      // which results in the browser blocking the request, without crashing the server.
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 86400, // 24 hours
});

/**
 * Log CORS configuration on startup
 */
export function logCorsConfig(): void {
  logger.info("🔒 CORS Configuration", {
    staticOrigins: ALLOWED_ORIGINS,
    cloudRunPattern: CLOUD_RUN_PATTERN.toString(),
    extraOrigins: EXTRA_ORIGINS.length > 0 ? EXTRA_ORIGINS : undefined,
  });
}
