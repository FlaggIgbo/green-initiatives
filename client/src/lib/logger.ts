/**
 * Client-side Logger for GCP Cloud Logging
 *
 * Sends errors to the server which logs them in GCP Cloud Logging format.
 * This enables:
 * - Client errors appearing in GCP Error Reporting
 * - Unified logging across client and server
 * - PagerDuty alerting for critical client errors
 *
 * Usage:
 *   import { clientLogger } from "@/lib/logger";
 *   clientLogger.error("Payment form failed", { userId: "123" });
 */

import { getApiUrl } from "./api-config";
import { getAuthHeaders } from "./auth-token";

interface LogPayload {
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Send log to server endpoint
 */
async function sendLog(
  level: "error" | "warn",
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const payload: LogPayload = {
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      extra,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Try to get userId from sessionStorage user object (if available)
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        payload.userId = user.id || user._id;
      } catch {
        // Ignore parsing errors
      }
    }

    await fetch(getApiUrl(`/api/log/${level}`), {
      method: "POST",
      headers: { ...headers, ...getAuthHeaders() },
      body: JSON.stringify(payload),
      credentials: "include",
    });
  } catch {
    // Silently fail - don't create infinite error loops
    // Fall back to console in development
    if (process.env.NODE_ENV !== "production") {
      console.error("[Logger] Failed to send log to server:", message);
    }
  }
}

/**
 * Log an error with stack trace
 */
async function logError(error: Error | string, extra?: Record<string, unknown>): Promise<void> {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("[ClientLogger]", message, extra);
  }

  await sendLog("error", message, { ...extra, stack });
}

/**
 * Log a warning
 */
async function logWarn(message: string, extra?: Record<string, unknown>): Promise<void> {
  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("[ClientLogger]", message, extra);
  }

  await sendLog("warn", message, extra);
}

/**
 * Log error with React component stack (for Error Boundaries)
 */
async function logComponentError(
  error: Error,
  componentStack: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("[ClientLogger] Component Error:", error, componentStack);
  }

  await sendLog("error", error.message, {
    ...extra,
    stack: error.stack,
    componentStack,
  });
}

/**
 * Client logger object
 */
export const clientLogger = {
  error: logError,
  warn: logWarn,
  componentError: logComponentError,
};

/**
 * Set up global error handlers
 * Call this once at app initialization
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    clientLogger.error(message, { type: "unhandledrejection", stack });
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    // Ignore errors from browser extensions or third-party scripts
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }

    clientLogger.error(event.message, {
      type: "uncaughtError",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });
}

export default clientLogger;
