import { test, expect } from "@playwright/test";

test.describe("Auth Page", () => {
  test.slow(); // Increase timeout for potentially slow environment

  test("should load auth page with sign in form", async ({ page }) => {
    await page.goto("/auth");

    await expect(page).toHaveURL(/\/auth/);

    // Use a more specific selector for the heading to avoid strict mode violations
    const heading = page
      .getByRole("heading", { name: /welcome|berry bank green hub|iniciar sesión|bem-vindo/i })
      .first();
    await expect(heading).toBeVisible();

    // Check for form fields using more robust selectors
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /login|iniciar|entrar/i })).toBeVisible();
  });

  test("should stay on auth page after invalid login", async ({ page }) => {
    await page.goto("/auth");

    await page.locator('input[name="username"]').fill("invaliduser");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();

    // Should stay on auth page (login failed)
    await expect(page).toHaveURL(/\/auth/);
    await expect(
      page.getByRole("heading", { name: /welcome|berry bank|login/i }).first(),
    ).toBeVisible();
  });

  test("should have register tab", async ({ page }) => {
    await page.goto("/auth");

    const registerTab = page.getByRole("tab", { name: /register|registrarse|registrar/i });
    await expect(registerTab).toBeVisible();
  });

  test("should successfully log in and redirect to home", async ({ page }) => {
    await page.goto("/auth");

    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();

    // Should redirect to home
    await expect(page).toHaveURL(/\/$/);

    // Verify sign out button is visible (it might be inside the menu)
    // First check if it's visible directly, if not, open the menu
    const signOutBtn = page.getByRole("button", { name: /sign out|sair/i });
    if (!(await signOutBtn.isVisible())) {
      await page.getByRole("button", { name: /open menu/i }).click();
    }
    await expect(signOutBtn).toBeVisible();
  });

  test("should log out and clear session", async ({ page, context }) => {
    // 1. Login first
    await page.goto("/auth");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
    await expect(page).toHaveURL(/\/$/);

    // 2. Verify cookie exists
    const cookiesBefore = await context.cookies();
    const tokenCookie = cookiesBefore.find((c) => c.name === "token");
    expect(tokenCookie).toBeTruthy();

    // 3. Perform Logout (Open menu)
    await page.getByRole("button", { name: /open menu/i }).click();
    await page.getByRole("button", { name: /sign out|sair/i }).click();

    // 4. Verify redirected to auth and cookie cleared
    await expect(page).toHaveURL(/\/auth/);
    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.find((c) => c.name === "token")).toBeFalsy();
  });

  test("should redirect unauthenticated user from protected routes", async ({ page }) => {
    // Try to access settings without being logged in
    await page.goto("/settings");

    // Should be redirected to auth
    await expect(page).toHaveURL(/\/auth/);
  });
});
