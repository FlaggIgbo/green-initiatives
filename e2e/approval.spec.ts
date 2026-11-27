import { test, expect } from "@playwright/test";

test.describe("Admin Approval Flow (Hermetic)", () => {
  test.slow();

  const projectTitle = `UAT Project ${Math.floor(Math.random() * 10000)}`;

  test("should create and approve a project as admin", async ({ page }) => {
    // 1. Mock Auth APIs
    await page.route("**/api/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "admin-id", username: "admin", role: "admin" }),
      });
    });

    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "admin-id", username: "admin", role: "admin" }),
      });
    });

    // 2. Mock Map APIs
    await page.route("**/api/map/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { lat: "19.4326", lon: "-99.1332", display_name: "Mexico City, Mexico" },
        ]),
      });
    });

    await page.route("**/api/map/reverse*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ display_name: "Mexico City, Mexico" }),
      });
    });

    // 3. Mock Organizations
    await page.route("**/api/organizations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "org-1", name: "Mock Organization", description: "A test organization" },
        ]),
      });
    });

    // 4. Mock Projects APIs
    const mockProject = {
      id: "proj-1",
      title: projectTitle,
      description: "Mocked description for E2E testing.",
      organizationId: "org-1",
      location: { lat: 19.4326, lng: -99.1332, address: "Mexico City, Mexico" },
      imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80",
      targetFunding: 10000,
      currentFunding: 0,
      progress: 0,
      status: "active",
      approvalStatus: "pending",
      createdBy: "admin-id",
      createdAt: new Date().toISOString(),
      proposal: {
        objectives: "Mocked objectives",
        methodology: "Mocked methodology",
        timeline: [{ phase: "P1", duration: "1m", deliverables: "D1" }],
        fundingBreakdown: [{ category: "C1", amount: 1000, description: "D1" }],
        measurableImpact: { metric: "M1", targetValue: 100, trackingMethod: "T1" },
      },
    };

    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProject),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockProject]),
        });
      }
    });

    await page.route("**/api/my-projects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockProject]),
      });
    });

    await page.route("**/api/projects/*/approval", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...mockProject, approvalStatus: "approved" }),
      });
    });

    // --- Start Test ---
    const ACTION_TIMEOUT = 5000;

    // 1. Login (Handle potential auto-login)
    await page.goto("/");

    // Wait for the page to be hydrated
    await page.waitForLoadState("networkidle");

    const authInput = page.locator('input[name="username"]');
    const signOutBtn = page.getByRole("button", { name: /sign out|cerrar sesión|sair/i });

    if (await authInput.isVisible({ timeout: 5000 })) {
      await authInput.fill("admin");
      await page.locator('input[type="password"]').fill("@berrybank1");
      await page.locator('button[type="submit"]').click();
    } else if (!(await signOutBtn.isVisible({ timeout: 2000 }))) {
      // Might be in mobile menu
      const menuBtn = page.getByRole("button", { name: /open menu/i });
      if (await menuBtn.isVisible({ timeout: 2000 })) {
        await menuBtn.click();
        if (!(await signOutBtn.isVisible({ timeout: 2000 }))) {
          await page.goto("/auth");
          await authInput.fill("admin");
          await page.locator('input[type="password"]').fill("@berrybank1");
          await page.locator('button[type="submit"]').click();
        }
      } else {
        await page.goto("/auth");
        await authInput.fill("admin");
        await page.locator('input[type="password"]').fill("@berrybank1");
        await page.locator('button[type="submit"]').click();
      }
    }

    // Wait for redirection
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 10000 });

    // 2. Go to create project
    await page.goto("/create");

    // Wait for the form to be ready
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    // Fill basic details
    await titleInput.fill(projectTitle);
    await page
      .locator('textarea[name="description"]')
      .fill(
        "This is a sufficiently long description to pass validation of at least 10 characters.",
      );

    // Select organization
    // Target the select trigger specifically by its placeholder to avoid picking RoleSwitcher
    const orgTrigger = page.getByPlaceholder(/Select an organization/i);
    if (!(await orgTrigger.isVisible())) {
      // Fallback to role if placeholder is not directly on the trigger
      await page.getByRole("combobox", { name: /organization/i }).click();
    } else {
      await orgTrigger.click();
    }

    // Select option (often in a portal)
    const option = page.getByRole("option", { name: /Mock Organization/i });
    await expect(option).toBeVisible({ timeout: ACTION_TIMEOUT });
    await option.click();

    await page.locator('input[name="targetFunding"]').fill("10000");

    // Location
    await page.getByPlaceholder(/search for an address/i).fill("Mexico City");
    // Wait for dropdown result and click it
    const resultItem = page.locator('button:has-text("Mexico City")').first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    await resultItem.click();

    // Proposal
    await page
      .locator('textarea[name="proposal.objectives"]')
      .fill(
        "This is a sufficiently long objectives string to pass validation of at least 10 characters.",
      );
    await page
      .locator('textarea[name="proposal.methodology"]')
      .fill(
        "This is a sufficiently long methodology string to pass validation of at least 10 characters.",
      );

    await page.locator('input[name="proposal.measurableImpact.metric"]').fill("Trees");
    await page.locator('input[name="proposal.measurableImpact.targetValue"]').fill("100");
    await page.locator('input[name="proposal.measurableImpact.trackingMethod"]').fill("Manual");

    // Submit
    await page
      .getByRole("button", { name: /create project|crear proyecto|criar projeto/i })
      .first()
      .click();

    // 4. Verify dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(projectTitle)).toBeVisible({ timeout: 5000 });

    // 5. Approve
    await page.route("**/api/my-projects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ ...mockProject, approvalStatus: "approved" }]),
      });
    });

    const approveBtn = page.getByRole("button", { name: /approve|aprobar|aprovar/i }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 6. Verify Approved status
    await expect(page.getByText(/approved|aprobado|aprovado/i).first()).toBeVisible();

    // 7. Verify Projects feed
    await page.route("**/api/projects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ ...mockProject, approvalStatus: "approved" }]),
      });
    });
    await page.goto("/projects");
    await expect(page.getByText(projectTitle)).toBeVisible();
  });
});
