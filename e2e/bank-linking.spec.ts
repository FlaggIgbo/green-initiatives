import { test, expect, Page } from "@playwright/test";

/**
 * 🛠️ UTILITY: Login helper that handles potential auto-login
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");

  const signOutBtn = page.getByRole("button", { name: /sign out|cerrar sesión|sair/i });
  const authInput = page.locator('input[name="username"]');

  if (await authInput.isVisible({ timeout: 2000 })) {
    await authInput.fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
  } else if (!(await signOutBtn.isVisible({ timeout: 2000 }))) {
    await page.goto("/auth");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
  }

  await expect(page).not.toHaveURL(/\/auth/, { timeout: 5000 });
}

test.describe("Bank Linking with Teller", () => {
  test.describe.configure({ mode: "serial" });

  test.use({
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
  });

  test("should successfully link a bank account via Teller Connect", async ({ page }) => {
    // Pipe browser console and page errors directly to the test logs
    page.on("console", (_msg) => {});
    page.on("pageerror", (_err) => {});

    // Increase test timeout to handle the full interactive flow and potential initial unlinking
    test.setTimeout(60000);
    const ACTION_TIMEOUT = 15000;

    await loginAsAdmin(page);

    // 1. Go to settings page
    await page.goto("/settings");

    // 2. Select Round-up tab
    const roundupTab = page.getByRole("tab", { name: /round-up|roundup/i });
    await expect(roundupTab).toBeVisible({ timeout: ACTION_TIMEOUT });
    await roundupTab.click();

    // Cleanup: Check if any accounts are already linked, and unlink them all to ensure a pristine state
    let unlinkBtn = page.getByRole("button", { name: /Unlink/i }).first();
    while (await unlinkBtn.isVisible({ timeout: 3000 })) {
      await unlinkBtn.click();
      // Wait for the specific account to disappear or just a short bit
      await page.waitForTimeout(1000);
      unlinkBtn = page.getByRole("button", { name: /Unlink/i }).first();
    }

    // 3. Locate bank connection section and click Link Bank Account
    const linkButton = page.getByRole("button", { name: /Link Bank Account/i });
    await expect(linkButton).toBeVisible({ timeout: ACTION_TIMEOUT });

    await linkButton.click();

    // 4. Verify Teller Connect dialog is displayed
    const dialogTitle = page.locator("span", { hasText: "Teller Connect" }).first();
    await expect(dialogTitle).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 5. Select the Teller Sandbox Bank option
    const sandboxBankBtn = page.getByRole("button", { name: /Teller Sandbox Bank/i });
    await expect(sandboxBankBtn).toBeVisible({ timeout: ACTION_TIMEOUT });
    await sandboxBankBtn.click();

    // 6. Enter mock online banking credentials
    const usernameInput = page.locator("#bank-username");
    const passwordInput = page.locator("#bank-password");

    await expect(usernameInput).toBeVisible({ timeout: ACTION_TIMEOUT });
    await expect(passwordInput).toBeVisible({ timeout: ACTION_TIMEOUT });

    await usernameInput.fill("teller_user");
    await passwordInput.fill("teller_secret_pass");

    const signInBtn = page.getByRole("button", { name: /Sign In/i });
    await expect(signInBtn).toBeVisible({ timeout: ACTION_TIMEOUT });
    await signInBtn.click();

    // 7. Verify we are on the account selection screen
    const selectAccountTitle = page.getByRole("heading", { name: /Select Account/i });
    await expect(selectAccountTitle).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 8. Select the checking account
    const checkingAccountBtn = page.getByRole("button", { name: /Teller Sandbox Checking/i });
    await expect(checkingAccountBtn).toBeVisible({ timeout: ACTION_TIMEOUT });
    await checkingAccountBtn.click();

    // 9. Verify the link success dialog step
    const successTitle = page.getByRole("heading", { name: /Account Linked!/i });
    await expect(successTitle).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 10. Click dashboard/go back button
    const confirmBtn = page.getByRole("button", { name: /Go to Dashboard/i });
    await expect(confirmBtn).toBeVisible({ timeout: ACTION_TIMEOUT });
    await confirmBtn.click();

    // 11. Assert that the linked bank account is displayed under the user settings
    const listedAccountText = page.getByText(/Teller Sandbox Checking/i).first();
    await expect(listedAccountText).toBeVisible({ timeout: ACTION_TIMEOUT });
  });

  test("should successfully enable round-ups and select projects", async ({ page }) => {
    // Pipe browser console and page errors directly to the test logs
    page.on("console", (_msg) => {});
    page.on("pageerror", (_err) => {});

    test.setTimeout(60000);
    const ACTION_TIMEOUT = 15000;

    await loginAsAdmin(page);

    // 1. Go to settings page
    await page.goto("/settings");

    // 2. Select Round-up tab
    const roundupTab = page.getByRole("tab", { name: /round-up|roundup/i });
    await expect(roundupTab).toBeVisible({ timeout: ACTION_TIMEOUT });
    await roundupTab.click();

    // 3. Locate the 'Enable Round-up' switch and toggle it on if it's off
    const roundupSwitch = page.getByRole("switch").first();
    await expect(roundupSwitch).toBeVisible({ timeout: ACTION_TIMEOUT });

    const isChecked = await roundupSwitch.getAttribute("aria-checked");
    if (isChecked !== "true") {
      await roundupSwitch.click();
      await expect(roundupSwitch).toHaveAttribute("aria-checked", "true", {
        timeout: ACTION_TIMEOUT,
      });
    }

    // Cleanup: Remove "Solar Energy Farm" if it is already in selected projects to ensure a clean state
    const removeBtn = page
      .locator("div")
      .filter({ hasText: "Solar Energy Farm - California" })
      .locator("button[aria-label='Remove project']")
      .first();
    if (await removeBtn.isVisible({ timeout: 2000 })) {
      await removeBtn.click();
      await expect(removeBtn).not.toBeVisible({ timeout: ACTION_TIMEOUT });
    }

    // 4. Locate project search input and type 'Solar Energy Farm'
    const searchInput = page.getByPlaceholder(/Search projects.../i);
    await expect(searchInput).toBeVisible({ timeout: ACTION_TIMEOUT });

    await searchInput.fill("Solar Energy Farm");

    // 5. Select the project from search results
    const searchResultBtn = page.getByRole("button", { name: /Solar Energy Farm/i }).first();
    await expect(searchResultBtn).toBeVisible({ timeout: ACTION_TIMEOUT });

    await searchResultBtn.click({ force: true });

    // 6. Click 'Save Round-up Projects' button
    const saveBtn = page.getByRole("button", { name: /Save Round-up Projects/i });
    await expect(saveBtn).toBeVisible({ timeout: ACTION_TIMEOUT });

    await saveBtn.click({ force: true });

    // 7. Verify success toast notification
    const successToast = page.getByText(/Round-up projects saved/i).first();
    await expect(successToast).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 8. Assert that 'Solar Energy Farm' is listed in 'Selected projects'
    const selectedProjectListText = page
      .locator("div")
      .filter({ hasText: "Solar Energy Farm - California" })
      .first();
    await expect(selectedProjectListText).toBeVisible({ timeout: ACTION_TIMEOUT });
  });

  test("should successfully trigger the round-up flush cron and verify on profile contribution history", async ({
    page,
  }) => {
    // Pipe browser console and page errors directly to the test logs
    page.on("console", (_msg) => {});
    page.on("pageerror", (_err) => {});

    test.setTimeout(25000);
    const ACTION_TIMEOUT = 10000;

    await loginAsAdmin(page);

    // 1. Fetch the project ID for "Solar Energy Farm - California"
    const projectsResponse = await page.request.get("/api/projects");
    expect(projectsResponse.ok()).toBeTruthy();
    const projects = await projectsResponse.json();
    const solarFarmProject = projects.find(
      (p: any) => p.title === "Solar Energy Farm - California",
    );
    expect(solarFarmProject).toBeDefined();
    const projectId = solarFarmProject.id;

    // 2. Programmatically link mock bank account and configure round-up settings
    await page.evaluate(
      async ({ projectId }) => {
        const token = sessionStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        // Ensure at least one mock bank account is linked
        await fetch("/api/roundup/link-bank-mock", {
          method: "POST",
          headers,
          body: JSON.stringify({
            displayName: "Teller Sandbox Checking",
            institutionName: "Teller Sandbox Bank",
            last4: "1234",
          }),
        });

        // Save round-up settings with Enable=true and dynamically fetched project ID
        await fetch("/api/user/roundup-settings", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            enabled: true,
            projectIds: [projectId],
          }),
        });

        // Fetch updated status to confirm
        await fetch("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        await fetch("/api/roundup/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
      },
      { projectId },
    );

    // 3. Trigger the round-up flush cron via API
    const response = await page.request.post("/api/cron/flush-roundups", {
      headers: {
        "X-Cron-Secret": "your-random-secret",
        "X-Bypass-Stripe-Check": "true",
      },
    });

    // Assert response status
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.flushed).toBeGreaterThanOrEqual(1);

    // 4. Navigate to user profile page
    await page.goto("/profile");

    // 5. Locate the 'Round-Up Settings' card and wait for the balance/donation details to load
    const roundupHeader = page.getByRole("heading", { name: /Round-Up Settings/i }).first();
    await expect(roundupHeader).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 6. Verify that the last donation is listed
    const lastDonationText = page.getByText(/Last donation:/i).first();
    await expect(lastDonationText).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 7. Verify that 'Solar Energy Farm - California' contribution is listed under 'Recent Contributions'
    const recentContributionItem = page
      .locator("div")
      .filter({ hasText: "Solar Energy Farm - California" })
      .first();
    await expect(recentContributionItem).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 8. Verify that the contribution amount is displayed in the list item
    const contributionAmountText = recentContributionItem.getByText(/[0-9]+/).first();
    await expect(contributionAmountText).toBeVisible({ timeout: ACTION_TIMEOUT });
  });
});
