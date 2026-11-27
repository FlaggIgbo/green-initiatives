import { test, expect, Page } from "@playwright/test";

/**
 * 🛠️ UTILITY: Login helper that handles potential auto-login
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");

  // If not on auth page, we might be logged in. Check for sign out button.
  const signOutBtn = page.getByRole("button", { name: /sign out|cerrar sesión|sair/i });
  const authInput = page.locator('input[name="username"]');

  if (await authInput.isVisible({ timeout: 2000 })) {
    await authInput.fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
  } else if (await signOutBtn.isVisible({ timeout: 2000 })) {
    // If we need to be SURE it's admin, we could logout first, but let's assume it's fine for now
    // or check profile name if needed.
  } else {
    await page.goto("/auth");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
  }

  await expect(page).not.toHaveURL(/\/auth/, { timeout: 5000 });
}

test.describe("Currency Display", () => {
  test.use({
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
  });

  test("should switch to MXN and reflect in project funding", async ({ page }) => {
    test.setTimeout(60000);
    const ACTION_TIMEOUT = 15000;

    await loginAsAdmin(page);

    // 1. Go to settings
    await page.goto("/settings");

    // 2. Ensure we are on the profile tab
    const profileTab = page.getByRole("tab", { name: /profile/i });
    await expect(profileTab).toBeVisible({ timeout: ACTION_TIMEOUT });
    await profileTab.click();

    // 3. Find and click the currency select trigger
    // Scope search to <main> to avoid header/footer selectors (like language/role switcher)
    const main = page.locator("main");
    const currencyCard = main
      .locator("div.card, div.rounded-lg.border")
      .filter({ hasText: "Display Currency" })
      .first();
    await expect(currencyCard).toBeVisible({ timeout: ACTION_TIMEOUT });

    const selectTrigger = currencyCard.getByRole("combobox");
    await expect(selectTrigger).toBeVisible({ timeout: ACTION_TIMEOUT });
    const currentCurrency = await selectTrigger.innerText();

    await selectTrigger.click();

    if (currentCurrency.includes("MXN")) {
      await page.getByRole("option", { name: /USD/i }).click();
      await expect(page.getByText(/updated|actualizado|atualizado/i).first()).toBeVisible({
        timeout: ACTION_TIMEOUT,
      });
      await selectTrigger.click();
    }

    // 4. Select MXN
    const mxnOption = page.getByRole("option", { name: /MXN/i });
    await expect(mxnOption).toBeVisible({ timeout: ACTION_TIMEOUT });
    await mxnOption.click();

    // 5. Verify success
    // Use .first() in case multiple toasts exist from retries/previous switches
    const toast = page.getByText(/updated|actualizado|atualizado/i).first();
    await expect(toast).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 6. Verify on projects page
    await page.goto("/projects");

    // Find a project that HAS a funding goal (not the open-ended Green Fund)
    const solarProject = page
      .locator("div.card, div.rounded-lg.border")
      .filter({ hasText: /Solar Energy Farm/i })
      .first();
    await expect(solarProject).toBeVisible({ timeout: ACTION_TIMEOUT });

    // Check for MX$ or MN$ in the project card
    // The project card shows "Raised MX$..." for projects with target funding
    await expect(solarProject).toContainText(/MX\$|MN\$/i, { timeout: ACTION_TIMEOUT });
  });
});
