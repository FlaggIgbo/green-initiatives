import { test, expect, Page } from "@playwright/test";

/**
 * 🛠️ UTILITY: Login helper that handles potential auto-login
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const authInput = page.locator('input[name="username"]');
  const signOutBtn = page.getByRole("button", { name: /sign out|cerrar sesión|sair/i });

  if (await authInput.isVisible({ timeout: 2000 })) {
    await authInput.fill("admin");
    await page.locator('input[type="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
  } else if (!(await signOutBtn.isVisible({ timeout: 2000 }))) {
    // Check mobile menu
    const menuBtn = page.getByRole("button", { name: /open menu/i });
    if (await menuBtn.isVisible({ timeout: 2000 })) {
      await menuBtn.click();
      if (!(await signOutBtn.isVisible({ timeout: 2000 }))) {
        await page.goto("/auth");
        await authInput.fill("admin");
        await page.locator('input[type="password"]').fill("@berrybank1");
        await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
      }
    } else {
      await page.goto("/auth");
      await authInput.fill("admin");
      await page.locator('input[type="password"]').fill("@berrybank1");
      await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
    }
  }

  await expect(page).not.toHaveURL(/\/auth/, { timeout: 10000 });
}

test.describe("Project Creation Flow", () => {
  test.slow();

  test.use({
    extraHTTPHeaders: {
      "x-playwright-test": "true",
    },
  });

  test("should successfully create a new project with image upload", async ({ page }) => {
    const ACTION_TIMEOUT = 5000;
    await loginAsAdmin(page);

    // 2. Navigate to Create Project page
    await page.goto("/create");
    await expect(page).toHaveURL(/\/create/, { timeout: 5000 });

    // 3. Fill in basic project details
    await page.locator('input[name="title"]').fill("Save the Redwoods");
    await page
      .locator('textarea[name="description"]')
      .fill("A project to protect and restore redwood forests in Northern California.");

    // Select organization
    const orgTrigger = page.getByPlaceholder(/Select an organization/i);
    if (!(await orgTrigger.isVisible())) {
      await page.getByRole("combobox", { name: /organization/i }).click();
    } else {
      await orgTrigger.click();
    }

    const option = page.getByRole("option", { name: /Green America Foundation/i });
    await expect(option).toBeVisible({ timeout: ACTION_TIMEOUT });
    await option.click();

    // Set funding target
    await page.locator('input[name="targetFunding"]').fill("50000");

    // Project Location
    const addressInput = page.getByPlaceholder(/Search for an address/i);
    await addressInput.fill("Redwood National Park");
    // Mock the geocoding response
    await page.route("**/api/map/search?q=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "41.2132",
            lon: "-124.0046",
            display_name: "Redwood National Park, California, USA",
          },
        ]),
      });
    });
    // Trigger search (it debounces, so wait or press enter if applicable)
    // Actually, it searches on change with debounce.
    const suggestion = page.getByRole("button", { name: /Redwood National Park/i });
    await expect(suggestion).toBeVisible({ timeout: ACTION_TIMEOUT });
    await suggestion.click();

    // 4. Test Supporting Document Upload
    await page.route("**/api/projects/upload-url", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadUrl: "https://mock-gcs-bucket.storage.googleapis.com/test-file-123",
          publicUrl: "https://storage.googleapis.com/green-initiatives-docs/test-file-123.pdf",
        }),
      });
    });

    await page.route(/.*storage.googleapis.com.*/, async (route) => {
      await route.fulfill({ status: 200 });
    });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: /select files|seleccionar archivos|selecionar arquivos/i })
      .click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "proposal.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("mock pdf content"),
    });

    await expect(page.getByText("proposal.pdf")).toBeVisible({ timeout: ACTION_TIMEOUT });

    // 5. Fill in Detailed Proposal
    await page
      .locator('textarea[name="proposal.objectives"]')
      .fill("Protect trees and restore ecosystem.");
    await page
      .locator('textarea[name="proposal.methodology"]')
      .fill("Satellite imagery and manual planting.");

    // Timeline
    await page.locator('input[name="proposal.timeline.0.phase"]').fill("Phase 1");
    await page.locator('input[name="proposal.timeline.0.duration"]').fill("3 months");
    await page.locator('input[name="proposal.timeline.0.deliverables"]').fill("Plan");

    // Funding Breakdown
    await page.locator('input[name="proposal.fundingBreakdown.0.category"]').fill("Trees");
    await page.locator('input[name="proposal.fundingBreakdown.0.amount"]').fill("50000");
    await page.locator('input[name="proposal.fundingBreakdown.0.description"]').fill("Saplings");

    // Measurable Impact
    await page.locator('input[name="proposal.measurableImpact.metric"]').fill("Trees planted");
    await page.locator('input[name="proposal.measurableImpact.targetValue"]').fill("10000");
    await page
      .locator('input[name="proposal.measurableImpact.trackingMethod"]')
      .fill("Manual count");

    // 6. Submit the form
    await page
      .getByRole("button", { name: /create project|crear proyecto|criar projeto/i })
      .first()
      .click();

    // 7. Verify success
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Success|Éxito|Sucesso/i).first()).toBeVisible({ timeout: 5000 });
  });
});
