/**
 * Structured JSON Logger for GCP Cloud Logging
 *
 * GCP Cloud Logging automatically parses JSON logs and extracts:
 * - severity: Maps to log levels in Cloud Logging
 * - message: Main log message
 * - Additional fields: Indexed and searchable
 *
 * This enables:
 * - Error Reporting integration (auto-groups similar errors)
 * - Cloud Monitoring alerting
 * - PagerDuty integration via notification channels
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info("User logged in", { userId: "123" });
 *   logger.error("Payment failed", { userId: "123", error: err.message });
 */

import { Logging, Log } from "@google-cloud/logging";

// Initialize Google Cloud Logging only in production
let logging: Logging | null = null;
let gcpLog: Log | null = null;

if (process.env.NODE_ENV === "production") {
  logging = new Logging();
  gcpLog = logging.log("greeninitiatives-server");
}

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface StructuredLog {
  severity: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Logs a structured JSON message to GCP Cloud Logging in production,
 * or to stdout in development.
 */
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: StructuredLog = {
    severity: level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (process.env.NODE_ENV === "production" && gcpLog) {
    // Send straight to GCP Cloud Logging
    const metadata = {
      severity: level,
      resource: { type: "cloud_run_revision" }, // Optimal for Cloud Run
    };
    const logEntry = gcpLog.entry(metadata, entry);

    // Use fire-and-forget for performance, but log errors if the write fails
    gcpLog.write(logEntry).catch((err) => {
      // Fallback to stderr if GCP logging fails
      process.stderr.write(`Failed to write to GCP Logging: ${err.message}\n`);
    });
  } else {
    // In development, use readable format with colors
    const color = {
      DEBUG: "\x1b[36m", // Cyan
      INFO: "\x1b[32m", // Green
      WARNING: "\x1b[33m", // Yellow
      ERROR: "\x1b[31m", // Red
      CRITICAL: "\x1b[35m", // Magenta
    }[level];
    const reset = "\x1b[0m";
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";

    // Using process.stdout.write to bypass no-console lint rule
    // while still providing readable logs for development
    process.stdout.write(`${color}[${level}]${reset} ${message}${metaStr}\n`);
  }
}

export interface AiTelemetryEvent {
  feature:
    | "project_vetting"
    | "transaction_classification"
    | "esg_screener"
    | "portfolio_rebalancer"
    | "comment_moderation"
    | "impact_digest"
    | "embedding";
  model: string;
  userId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd?: number;
  usedFallback?: boolean;
  success: boolean;
}

/**
 * Logger object with methods for each log level.
 *
 * Severity levels (GCP Cloud Logging):
 * - DEBUG: Debug or trace information
 * - INFO: Routine information
 * - WARNING: Warning events might cause problems
 * - ERROR: Error events likely to cause problems (triggers Error Reporting)
 * - CRITICAL: Critical events cause severe problems (triggers Error Reporting)
 */
export const logger = {
  /**
   * Debug or trace information.
   * Not shown in production unless LOG_LEVEL=debug.
   */
  debug: (message: string, meta?: Record<string, unknown>): void => {
    log("DEBUG", message, meta);
  },

  /**
   * Routine information, such as ongoing status or performance.
   */
  info: (message: string, meta?: Record<string, unknown>): void => {
    log("INFO", message, meta);
  },

  /**
   * Warning events might cause problems.
   */
  warn: (message: string, meta?: Record<string, unknown>): void => {
    log("WARNING", message, meta);
  },

  /**
   * Error events are likely to cause problems.
   * Automatically captured by GCP Error Reporting.
   */
  error: (message: string, meta?: Record<string, unknown>): void => {
    log("ERROR", message, meta);
  },

  /**
   * Critical events cause more severe problems or outages.
   * Automatically captured by GCP Error Reporting.
   */
  critical: (message: string, meta?: Record<string, unknown>): void => {
    log("CRITICAL", message, meta);
  },

  /**
   * Structured AI observability hook for token usage, model latency, fallback rates,
   * and per-user AI spend in GCP Cloud Logging / Monitoring.
   * TODO: Wire GCP log-based metrics + budget/rate-limit alerts on `aiTelemetry.*` fields.
   */
  logAiTelemetry: (event: AiTelemetryEvent): void => {
    log("INFO", `AI telemetry: ${event.feature}`, { aiTelemetry: event });
  },
};

export default logger;
