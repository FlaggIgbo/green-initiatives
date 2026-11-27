import { test, expect } from "@playwright/test";

test.describe("Projects Page", () => {
  test("should load projects page or redirect to auth", async ({ page }) => {
    await page.goto("/projects");

    const url = page.url();
    const isProjects = url.includes("/projects");
    const isAuth = url.includes("/auth");

    expect(isProjects || isAuth).toBeTruthy();

    if (isProjects) {
      await expect(page.getByText(/project|proyecto|projeto/i).first()).toBeVisible({
        timeout: 8000,
      });
    }
  });

  test("should show app header on projects page", async ({ page }) => {
    await page.goto("/projects");

    // Either we land on projects (header visible) or auth (different header)
    await expect(page.getByRole("link", { name: "Berry Bank Green Hub" })).toBeVisible();
  });
});

/*
 * TODO: Add more projects page tests:
 * - [ ] Project cards render with title, funding, category
 * - [ ] Click project card navigates to project details
 * - [ ] Search/filter projects by name, category, location
 * - [ ] Map view shows project markers (if enabled)
 * - [ ] Funding a project opens Stripe checkout (mock)
 * - [ ] Comments section works when logged in
 * - [ ] 404 for non-existent project ID
 * - [ ] i18n: Project labels and status change with locale
 */
