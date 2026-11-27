import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load home page and show environmental projects content", async ({ page }) => {
    await page.goto("/");

    // Unauthenticated users land on home or may be redirected to auth
    const url = page.url();
    const isHome = url.endsWith("/") || url.includes("/#");

    if (isHome) {
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      // App name in header
      await expect(page.getByRole("link", { name: "Berry Bank Green Hub" })).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: /sign in|iniciar sesión|entrar/i }),
      ).toBeVisible();
    }
  });

  test("should have navigation with Projects link", async ({ page }) => {
    await page.goto("/");

    // Projects or Sign In should be visible in nav (only if not on auth page)
    if (!page.url().includes("/auth")) {
      // 1. Open the menu first (as links are hidden in mobile-first Sheet)
      const menuBtn = page.getByRole("button", { name: /open menu/i });
      await expect(menuBtn).toBeVisible({ timeout: 5000 });
      await menuBtn.click();

      // 2. Check for links
      const projectsLink = page.getByRole("link", { name: /projects/i }).first();

      // We expect at least the projects link to be visible now that home is public
      await expect(projectsLink).toBeVisible({ timeout: 5000 });
    }
  });
});

/*
 * TODO: Add more home page tests:
 * - [ ] Donor user sees project cards/carousel on home
 * - [ ] Entity user is redirected to /dashboard
 * - [ ] Search bar works and filters projects
 * - [ ] i18n: Home page content changes with locale
 * - [ ] Growing tree / points visible when logged in
 */
