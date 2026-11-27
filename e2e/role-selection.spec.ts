import { test, expect } from "@playwright/test";

test.describe("Role Selection & Quick Login", () => {
  test.slow();
  test.beforeEach(async ({ page }) => {
    // Ensure we are logged out before each test
    await page.goto("/");
    const signOutBtn = page.getByRole("button", { name: /sign out|sair/i });
    if (await signOutBtn.isVisible()) {
      await page.getByRole("button", { name: /open menu/i }).click();
      await signOutBtn.click();
    }
  });

  test("should show quick login options in dev mode when logged out", async ({ page }) => {
    await page.goto("/");

    // Check for the "Login As:" text in the banner
    const loginAsText = page.getByText(/Login As:/i);
    await expect(loginAsText).toBeVisible();

    // Check if we can see the role selector
    const roleSelector = page.getByLabel("Select Role");
    await expect(roleSelector).toBeVisible();
  });

  test("should quick login as admin", async ({ page }) => {
    await page.goto("/");

    // Select Admin from the quick login dropdown
    await page.getByLabel("Select Role").click();
    await page.getByRole("option", { name: "Admin" }).click();

    // Should be logged in - wait for the banner text to change from "Login As:" to "Role:"
    await expect(page.getByText(/Role:/i)).toBeVisible({ timeout: 20000 });

    // Check for admin-specific link in the menu
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });

  test("should quick login as user (customer)", async ({ page }) => {
    await page.goto("/");

    // Select User from the quick login dropdown
    await page.getByLabel("Select Role").click();
    await page.getByRole("option", { name: "User" }).click();

    // Should be logged in
    await expect(page.getByText(/Role:/i)).toBeVisible({ timeout: 20000 });

    // User should NOT see Dashboard link
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).not.toBeVisible();
  });
});
