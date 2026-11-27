/* eslint-disable no-console */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium, type Page } from "@playwright/test";

// When run via tsx, esbuild injects `__name(fn, "name")` helpers into named
// functions. Callbacks passed to page.evaluate()/addInitScript() are serialized
// into the browser, where that helper does not exist, so define a no-op shim.
const TSX_NAME_SHIM = "globalThis.__name = globalThis.__name || ((fn) => fn);";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect whether running against a remote deployment or local preview server
const targetArg = process.argv.find(
  (arg) => arg.startsWith("http://") || arg.startsWith("https://"),
);
const TARGET_URL = process.env.TARGET_URL || targetArg || null;
const isRemote = Boolean(TARGET_URL);

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_PUBLIC_DIR = path.resolve(ROOT_DIR, "dist/public");
const RECORDINGS_DIR = path.resolve(ROOT_DIR, "recordings");
const DOWNLOADS_DIR =
  process.env.DOWNLOADS_DIR ||
  (process.env.HOME ? path.resolve(process.env.HOME, "Downloads") : RECORDINGS_DIR);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function ensureClientBuild() {
  if (process.env.SKIP_BUILD === "1" && fs.existsSync(path.join(DIST_PUBLIC_DIR, "index.html"))) {
    console.log("⏭️  SKIP_BUILD=1 and dist/public exists; skipping Vite build.");
    return;
  }
  console.log("🔨 Building React client bundle (vite build)...");
  execSync("npx vite build", {
    cwd: ROOT_DIR,
    stdio: "pipe",
  });
}

function startStaticSpaServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname === "/") {
        pathname = "/index.html";
      }

      let filePath = path.join(DIST_PUBLIC_DIR, pathname);
      if (!filePath.startsWith(DIST_PUBLIC_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_PUBLIC_DIR, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 4173;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function setupStatefulE2EMocks(page: Page) {
  let currentUser: Record<string, unknown> | null = null;
  const linkedAccounts: Record<string, unknown>[] = [];
  const projects = [
    {
      id: "proj_solar_ca",
      title: "Solar Energy Farm - California",
      description: "Community-owned solar microgrid reducing fossil-fuel generation.",
      organizationId: "org_1",
      location: { lat: 36.7783, lng: -119.4179, address: "Fresno, CA, USA" },
      imageUrl: "",
      targetFunding: 50000,
      currentFunding: 34250,
      progress: 68,
      status: "active",
      createdBy: "usr_e2e_1",
      approvalStatus: "approved",
      createdAt: "2026-02-01T10:00:00.000Z",
      allowedEnvironments: ["development", "sandbox", "production"],
      proposal: {
        objectives: "Deploy 250kW of rooftop solar panels.",
        methodology: "IoT smart meter verification.",
        timeline: [{ phase: "Phase 1", duration: "Q1", deliverables: "Installation" }],
        fundingBreakdown: [{ category: "Hardware", amount: 50000, description: "Panels" }],
        measurableImpact: {
          metric: "kg CO2 offset",
          targetValue: 120000,
          trackingMethod: "IoT Smart Meter",
        },
      },
      impactMetrics: {
        type: "carbon",
        unit: "kg CO2",
        targetAmount: 120000,
        currentAmount: 81600,
        perDollar: 2.4,
      },
    },
  ];

  await page.context().route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    const method = req.method();
    let body: Record<string, unknown> = {};
    try {
      body = (req.postDataJSON() as Record<string, unknown>) || {};
    } catch {
      body = {};
    }

    if (pathname.endsWith("/api/config")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stripeDisabled: false, environment: "development" }),
      });
    }

    if (pathname.endsWith("/api/locale")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locale: "en-US", currency: "USD" }),
      });
    }

    if (pathname.endsWith("/api/login") && method === "POST") {
      currentUser = {
        id: "usr_e2e_1",
        username: String(body.username || "admin"),
        fullName: "E2E Admin",
        email: "admin@greeninitiatives.local",
        role: "admin",
        points: 100,
        treeGrowth: 25,
        sunwaterCoins: 50,
        allowedEnvironment: "development",
        roundUpEnabled: false,
        roundUpProjectIds: [],
        roundUpBalanceCents: 0,
        preferredCurrency: "USD",
        createdAt: new Date().toISOString(),
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: currentUser, token: "e2e-mock-token" }),
      });
    }

    if (pathname.endsWith("/api/user")) {
      if (!currentUser) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unauthorized" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUser),
      });
    }

    if (pathname.endsWith("/api/projects") || pathname.endsWith("/api/my-projects")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(projects),
      });
    }

    if (/\/api\/projects\/[^/]+\/comments$/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ comments: [], count: 0 }),
      });
    }

    if (/\/api\/projects\/[^/]+$/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(projects[0]),
      });
    }

    if (pathname.endsWith("/api/roundup/link-bank-mock") && method === "POST") {
      const account = {
        id: `acc_${linkedAccounts.length + 1}`,
        userId: "usr_e2e_1",
        stripeAccountId: `mock_acc_${linkedAccounts.length + 1}`,
        displayName: String(body.displayName || "Plaid Sandbox Checking"),
        institutionName: String(body.institutionName || "Plaid Sandbox Bank"),
        last4: String(body.last4 || "1234"),
        status: "active",
        createdAt: new Date().toISOString(),
      };
      linkedAccounts.push(account);
      if (currentUser) {
        currentUser.roundUpBalanceCents = 1000;
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(account),
      });
    }

    if (pathname.endsWith("/api/roundup/linked-accounts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(linkedAccounts),
      });
    }

    if (pathname.endsWith("/api/user/roundup-settings") && method === "PATCH") {
      if (currentUser) {
        if (typeof body.enabled === "boolean") currentUser.roundUpEnabled = body.enabled;
        if (Array.isArray(body.projectIds)) currentUser.roundUpProjectIds = body.projectIds;
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUser),
      });
    }

    if (pathname.endsWith("/api/roundup/summary")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balanceCents: Number(currentUser?.roundUpBalanceCents ?? 0),
          batches: [],
        }),
      });
    }

    if (pathname.endsWith("/api/user/contributions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

async function main() {
  console.log("========================================================================");
  console.log("🎬 Starting Playwright E2E Flow with Browser Automation & Recording");
  console.log(`   Recording Folder: ${RECORDINGS_DIR}`);
  console.log("========================================================================\n");

  let localServer: http.Server | null = null;
  let webUrl = TARGET_URL ? TARGET_URL.replace(/\/+$/, "") : "";

  if (!isRemote) {
    ensureClientBuild();
    const started = await startStaticSpaServer();
    localServer = started.server;
    webUrl = started.baseUrl;
    console.log(`✅ Local web server listening at ${webUrl}\n`);
  }

  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  if (!process.env.CI) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  const isHeadless = process.env.HEADLESS === "true" || process.env.CI === "true";
  console.log(`🌐 Launching Chromium browser (headless: ${isHeadless})...`);
  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 250,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1280, height: 850 },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(TSX_NAME_SHIM);

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    if (!isRemote) {
      await setupStatefulE2EMocks(page);
    }

    // 1. Login via /auth
    console.log("1️⃣  Navigating to /auth and signing in...");
    await page.goto(`${webUrl}/auth`, { waitUntil: "networkidle" });
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("@berrybank1");
    await page.getByRole("button", { name: /login|iniciar|entrar/i }).click();
    await page.waitForURL((u) => !u.pathname.includes("/auth"), { timeout: 15000 });
    console.log("   ✓ Signed in successfully");

    // 2. Browse Projects Marketplace
    console.log("2️⃣  Browsing /projects marketplace...");
    await page.goto(`${webUrl}/projects`, { waitUntil: "networkidle" });
    await page
      .getByText(/Solar Energy Farm - California/i)
      .first()
      .waitFor({ timeout: 15000 });
    console.log("   ✓ Projects marketplace rendered");

    // 3. Open Project Details
    console.log("3️⃣  Opening Project Details...");
    await page.goto(`${webUrl}/project/proj_solar_ca`, { waitUntil: "networkidle" });
    await page
      .getByText(/Solar Energy Farm - California/i)
      .first()
      .waitFor({ timeout: 15000 });
    console.log("   ✓ Project details loaded");

    // 4. Link Bank Account via Plaid Link Dialog in Settings
    console.log("4️⃣  Testing Plaid Link bank connection in /settings...");
    await page.goto(`${webUrl}/settings?tab=roundup`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Link Bank Account/i }).click();
    await page.locator("span", { hasText: "Plaid Link" }).first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Plaid Sandbox Bank/i }).click();
    await page.locator("#bank-username").fill("plaid_user");
    await page.locator("#bank-password").fill("plaid_secret_pass");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await page.getByRole("button", { name: /Plaid Sandbox Checking/i }).click();
    await page.getByRole("heading", { name: /Account Linked!/i }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Go to Dashboard/i }).click();
    await page
      .getByText(/Plaid Sandbox Checking/i)
      .first()
      .waitFor({ timeout: 10000 });
    console.log("   ✓ Plaid Sandbox Checking linked");

    // 5. Visit Profile & Dashboard
    console.log("5️⃣  Verifying /profile and /dashboard...");
    await page.goto(`${webUrl}/profile`, { waitUntil: "networkidle" });
    await page.goto(`${webUrl}/dashboard`, { waitUntil: "networkidle" });
    console.log("   ✓ Profile and Partner Dashboard rendered cleanly");

    if (pageErrors.length > 0) {
      throw new Error(`Uncaught page errors during E2E flow:\n${pageErrors.join("\n")}`);
    }

    console.log("\n✅ All Playwright E2E flow steps passed!");
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (localServer) localServer.close();

    if (video) {
      const rawPath = await video.path();
      const targetRecording = path.join(RECORDINGS_DIR, "e2e-playwright-flow.webm");
      fs.renameSync(rawPath, targetRecording);
      console.log(`🎥 Saved E2E recording: ${targetRecording}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Playwright E2E flow failed:", err);
  process.exit(1);
});
