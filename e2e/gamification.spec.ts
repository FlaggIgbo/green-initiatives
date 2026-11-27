import { test, expect } from "@playwright/test";

test.describe("Gamification & Digital Plant", () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    // Register a new user for each test to have a clean state
    const username = `user_${Math.random().toString(36).substring(7)}`;
    await page.goto("/auth");
    await page.getByRole("tab", { name: /register|registrarse|registrar/i }).click();
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="email"]').fill(`${username}@example.com`);
    await page.locator('input[name="password"]').fill("password123");
    await page.getByRole("button", { name: /register|registrarse|registrar/i }).click();

    // Should be redirected to home
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
  });

  test("should receive daily login coins and be able to water the tree", async ({ page }) => {
    // 1. Verify initial coins (New user should have 10 coins)
    const coinsElement = page.locator("text=Coins").locator("xpath=following-sibling::p").first();
    await expect(coinsElement).toBeVisible({ timeout: 10000 });
    await expect(coinsElement).toHaveText("10");

    // 2. Verify initial growth is 0%
    const growthElement = page.locator("text=%").first();
    await expect(growthElement).toHaveText("0%");

    // 3. Click Water Tree button
    const waterButton = page.getByRole("button", { name: /💧/ });
    await expect(waterButton).toBeEnabled();
    await waterButton.click();

    // 4. Verify toast notification (using first() to avoid strict mode violation with ARIA status)
    await expect(page.getByText(/Tree watered!|Árbol regado!/i).first()).toBeVisible();

    // 5. Verify coins decreased to 0
    await expect(coinsElement).toHaveText("0");

    // 6. Verify growth increased to 5%
    await expect(growthElement).toHaveText("5%");

    // 7. Verify persistence on reload
    await page.reload();
    await expect(coinsElement).toHaveText("0");
    await expect(growthElement).toHaveText("5%");
  });

  test("should disable water button when not enough coins", async ({ page }) => {
    // 1. Water the tree once (spends all 10 coins)
    const waterButton = page.getByRole("button", { name: /💧/ });
    await expect(waterButton).toBeVisible({ timeout: 10000 });
    await waterButton.click();

    // 2. Verify button is now disabled
    await expect(waterButton).toBeDisabled();

    // 3. Check tooltip/title for "Need 10 coins"
    const title = await waterButton.getAttribute("title");
    expect(title).toMatch(/Need 10 coins|Necesitas 10 monedas/i);
  });
});
