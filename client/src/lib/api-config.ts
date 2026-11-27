/**
 * API Configuration
 *
 * Handles the API base URL for different environments.
 * In development, the API is served from the same origin.
 * In production (decoupled), the API URL is provided via build-time env var.
 */

import { ENVIRONMENTS, type Environment } from "@shared/schema-mongo";

// VITE_API_URL is set at build time via Dockerfile or .env file
// Examples:
//   - Development: undefined (uses relative URLs like /api/...)
//   - Production: https://greeninitiatives-server-prod-xxxxx.run.app
const BUILD_TIME_API_URL = import.meta.env.VITE_API_URL || "";

// Deployed server URLs for local development environment switching
const SANDBOX_SERVER_URL = "https://greeninitiatives-server-sandbox-fdoxa6bvkq-uc.a.run.app";
const PRODUCTION_SERVER_URL = "https://greeninitiatives-server-prod-fdoxa6bvkq-uc.a.run.app";

/**
 * Detect the current environment name.
 */
export function getDetectedEnvironment(): Environment {
  try {
    // 1. Check query parameter first (allows overriding for testing)
    const searchParams = new URLSearchParams(window.location.search);
    const env = searchParams.get("env");

    if (env === "sandbox") return ENVIRONMENTS.sandbox;
    if (env === "production") return ENVIRONMENTS.production;

    // 2. Check hostname
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0";

    if (!isLocalhost) {
      // If we're not on localhost, we're either on sandbox or production domain.
      if (window.location.hostname.includes("-sandbox-")) {
        return ENVIRONMENTS.sandbox;
      }
      return ENVIRONMENTS.production;
    }
  } catch (_e) {
    // Fallback
  }

  return ENVIRONMENTS.development;
}

/**
 * Detect the target API base URL based on build-time config and runtime query params.
 * When deployed on Cloud Run client URLs, we use hostname-based fallback so the app
 * always hits the correct server even if VITE_API_URL was missing at build time.
 */
function getTargetBaseUrl(): string {
  try {
    // 1. Check query parameter first
    const searchParams = new URLSearchParams(window.location.search);
    const env = searchParams.get("env");

    if (env === "sandbox") {
      return SANDBOX_SERVER_URL;
    }

    if (env === "production") {
      return PRODUCTION_SERVER_URL;
    }

    // 2. Check hostname (deployed client)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0";

    if (!isLocalhost) {
      // Use hostname-based fallback so sandbox/prod client always targets the right server
      if (window.location.hostname.includes("-sandbox-")) {
        return SANDBOX_SERVER_URL;
      }
      if (window.location.hostname.includes("-prod-")) {
        return PRODUCTION_SERVER_URL;
      }
      return BUILD_TIME_API_URL;
    }
  } catch (_e) {
    // Fallback if window/location is not available
  }

  return BUILD_TIME_API_URL;
}

/**
 * Get the full API URL for a given endpoint
 * @param endpoint - The API endpoint (e.g., "/api/projects")
 * @returns Full URL with base if configured
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getTargetBaseUrl();

  // If no base URL configured, use relative path (same-origin)
  if (!baseUrl) {
    return endpoint;
  }

  // Ensure no double slashes when joining
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return `${base}${path}`;
}

/**
 * Get the WebSocket URL for real-time updates
 * @returns WebSocket URL
 */
export function getWebSocketUrl(): string {
  const baseUrl = getTargetBaseUrl();

  if (!baseUrl) {
    // Same origin - derive from current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  // External API - convert HTTP(S) to WS(S)
  const wsUrl = baseUrl.replace(/^http/, "ws");
  const base = wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;
  return `${base}/ws`;
}

/**
 * Check if we're using an external API (decoupled deployment)
 */
export function isExternalApi(): boolean {
  return !!getTargetBaseUrl();
}

export const API_BASE_URL = BUILD_TIME_API_URL; // Keep export for compatibility
