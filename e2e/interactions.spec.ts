import { test, expect, Page } from "@playwright/test";

/**
 * 🛠️ UTILITY: Fast API-based login
 */
async function loginAsAdmin(page: Page) {
  // Use page.request to ensure cookies are shared with the browser context
  const response = await page.request.post("/api/login", {
    data: { username: "admin", password: "@berrybank1" },
    headers: { "x-playwright-test": "true" },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  // Also set sessionStorage as a backup for the UI state
  await page.addInitScript((user) => {
    sessionStorage.setItem("user", JSON.stringify(user));
    sessionStorage.setItem("locale", "en-US");
    const style = document.createElement("style");
    style.innerHTML = "* { transition: none !important; animation: none !important; }";
    document.head.appendChild(style);
  }, data.user);
}

test.describe("Project Interactions", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const projectsRes = await request.get("/api/projects", {
      headers: { "x-playwright-test": "true" },
    });
    const projects = await projectsRes.json();
    projectId = projects[0].id;
  });

  test.use({
    extraHTTPHeaders: { "x-playwright-test": "true" },
  });

  test("should allow leaving a comment", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/project/${projectId}`);

    // Wait for the comment section to load
    const commentInput = page.locator("#comment-input");
    await expect(commentInput).toBeVisible({ timeout: 15000 });

    const commentContent = `Test comment ${Date.now()}`;
    await commentInput.fill(commentContent);
    await page.getByRole("button", { name: /post comment/i }).click();

    // Verify the comment appears
    await expect(page.locator("p").filter({ hasText: commentContent }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("should allow replying to a comment", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });

    const commentContent = `Parent for reply ${Date.now()}`;
    const textarea = page.locator('textarea[placeholder*="thoughts"]');
    await textarea.fill(commentContent);
    await page.getByRole("button", { name: /post comment/i }).click();

    const commentCard = page.locator("div.relative").filter({ hasText: commentContent }).first();
    await commentCard.getByRole("button", { name: /reply/i }).click();

    const replyContent = `Nested reply ${Date.now()}`;
    await page.locator('textarea[placeholder*="thoughts"]').fill(replyContent);
    await page
      .locator("form")
      .getByRole("button", { name: /^reply$/i, exact: true })
      .click();

    await expect(page.locator("div.ml-8").filter({ hasText: replyContent }).first()).toBeVisible();
  });

  test("should allow liking a comment", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });

    const commentContent = `Like test ${Date.now()}`;
    const textarea = page.locator('textarea[placeholder*="thoughts"]');
    await textarea.fill(commentContent);
    await page.getByRole("button", { name: /post comment/i }).click();

    const commentCard = page.locator("div.relative").filter({ hasText: commentContent }).first();
    const likeButton = commentCard
      .locator("button")
      .filter({ has: page.locator("svg.lucide-heart") });
    await likeButton.click();
    await expect(likeButton).toContainText("1");
  });
});
