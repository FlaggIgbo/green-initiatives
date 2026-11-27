import { test, expect } from "@playwright/test";

test.describe("404 Not Found", () => {
  test("should show 404 page for unknown route", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz-123");

    await expect(
      page.getByText(/not found|página no encontrada|página não encontrada|404/i),
    ).toBeVisible({ timeout: 5000 });
  });
});

/*
 * TODO: Add more error/edge case tests:
 * - [ ] Invalid project ID shows project not found message
 * - [ ] Error boundary fallback on client crash
 * - [ ] Network offline handling
 */
