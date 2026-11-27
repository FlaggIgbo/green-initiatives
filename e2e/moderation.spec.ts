import { test, expect, Page } from "@playwright/test";

async function fastLogin(page: Page, credentials: { username: string; password: string }) {
  const response = await page.request.post("/api/login", {
    data: credentials,
    headers: { "x-playwright-test": "true" },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  await page.addInitScript((user) => {
    sessionStorage.setItem("user", JSON.stringify(user));
    sessionStorage.setItem("locale", "en-US");
    const style = document.createElement("style");
    style.innerHTML = "* { transition: none !important; animation: none !important; }";
    document.head.appendChild(style);
  }, data.user);
}

test.describe("Community Moderation", () => {
  const adminCredentials = { username: "admin", password: "@berrybank1" };
  const userCredentials = { username: "mock_entity", password: "mock_password_123" };
  let projectId: string;
  const commentText = `Report test ${Date.now()}`;

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

  test("should allow reporting a comment", async ({ page }) => {
    test.slow();
    // 1. Post a comment as admin
    await fastLogin(page, adminCredentials);
    await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });
    await page.locator('textarea[placeholder*="thoughts"]').fill(commentText);
    await page.getByRole("button", { name: /post comment/i }).click();
    await expect(page.locator("p").filter({ hasText: commentText }).first()).toBeVisible();

    // 2. Report it as another user
    await page.evaluate(() => sessionStorage.clear());
    await fastLogin(page, userCredentials);
    await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });

    const commentCard = page.locator("div.relative").filter({ hasText: commentText }).first();
    await commentCard.getByLabel(/comment options/i).click();
    await page.getByRole("menuitem", { name: /report/i }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /spam/i }).click();
    await page.getByRole("button", { name: /submit report/i }).click();
    await expect(page.getByText(/reported/i).first()).toBeVisible();
  });

  test("should allow admin to hide a flagged comment", async ({ page, request }) => {
    // This test assumes the previous test ran, but to be safe we use a unique tag
    const uniqueText = `Hide test ${Date.now()}`;

    // 1. Setup flagged comment via API (fastest)
    await request.post("/api/login", { data: adminCredentials });
    const postRes = await request.post(`/api/projects/${projectId}/comments`, {
      data: { content: uniqueText },
    });
    const comment = await postRes.json();

    await request.post("/api/login", { data: userCredentials });
    await request.patch(`/api/comments/${comment.id}/flag`, {
      data: { reason: "spam" },
    });

    // 2. Moderate as Admin via API
    await request.post("/api/login", { data: adminCredentials });
    await request.post(`/api/admin/comments/${comment.id}/moderate`, {
      data: { action: "hide", reason: "UAT" },
    });

    // 3. Verify in UI
    await fastLogin(page, userCredentials);
    await page.goto(`/project/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(uniqueText)).not.toBeVisible();
  });
});
