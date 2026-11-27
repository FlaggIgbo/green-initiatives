import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for GreenInitiatives.
 *
 * To run tests locally:
 *   1. Start the app: npm run dev
 *   2. In another terminal: npm run test:e2e
 *
 * Or use headed/UI mode for debugging:
 *   npm run test:e2e:ui
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8000",
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  webServer: {
    command: "NODE_ENV=test CI=true npm run dev:no-watch",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
