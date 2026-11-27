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

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_PUBLIC_DIR = path.resolve(ROOT_DIR, "dist/public");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");
const COMPONENTS_DIR = path.resolve(SCREENSHOTS_DIR, "components");
const PAGES_DIR = path.resolve(SCREENSHOTS_DIR, "pages");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const MOCK_USER = {
  id: "usr_demo_1",
  username: "admin",
  fullName: "Alex Green",
  email: "alex@greeninitiatives.local",
  role: "admin",
  points: 450,
  treeGrowth: 65,
  sunwaterCoins: 120,
  allowedEnvironment: "development",
  roundUpEnabled: true,
  roundUpProjectIds: ["proj_solar_ca"],
  roundUpBalanceCents: 385,
  preferredCurrency: "USD",
  createdAt: "2026-01-15T12:00:00.000Z",
};

const MOCK_PROJECTS = [
  {
    id: "proj_solar_ca",
    title: "Solar Energy Farm - California",
    description:
      "Community-owned solar microgrid reducing peak fossil-fuel generation across central California school districts.",
    organizationId: "org_1",
    location: {
      lat: 36.7783,
      lng: -119.4179,
      address: "Fresno, CA, USA",
    },
    imageUrl: "",
    targetFunding: 50000,
    currentFunding: 34250,
    progress: 68,
    status: "active",
    createdBy: "usr_demo_1",
    approvalStatus: "approved",
    createdAt: "2026-02-01T10:00:00.000Z",
    allowedEnvironments: ["development", "sandbox", "production"],
    proposal: {
      objectives: "Deploy 250kW of rooftop solar panels across 5 public schools.",
      methodology: "Verified smart-meter telemetry streaming hourly kWh offsets.",
      timeline: [
        { phase: "Phase 1", duration: "Q1 2026", deliverables: "Permits & panel procurement" },
        { phase: "Phase 2", duration: "Q2 2026", deliverables: "Installation & grid tie-in" },
      ],
      fundingBreakdown: [
        { category: "Hardware", amount: 35000, description: "Solar arrays & inverters" },
        { category: "Installation", amount: 15000, description: "Certified union labor" },
      ],
      measurableImpact: {
        metric: "kg CO2 offset",
        targetValue: 120000,
        trackingMethod: "IoT Smart Meter Telemetry",
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
  {
    id: "proj_urban_forest",
    title: "Urban Canopy & Heat Reduction",
    description:
      "Planting native drought-tolerant shade trees along transit corridors and public playgrounds.",
    organizationId: "org_2",
    location: {
      lat: 33.4484,
      lng: -112.074,
      address: "Phoenix, AZ, USA",
    },
    imageUrl: "",
    targetFunding: 25000,
    currentFunding: 16400,
    progress: 66,
    status: "active",
    createdBy: "usr_demo_1",
    approvalStatus: "approved",
    createdAt: "2026-02-12T10:00:00.000Z",
    allowedEnvironments: ["development", "sandbox", "production"],
    proposal: {
      objectives: "Lower neighborhood street temperatures by 4°F during peak summer.",
      methodology: "Satellite canopy imagery + annual arborist audits.",
      timeline: [
        { phase: "Phase 1", duration: "Spring 2026", deliverables: "Soil prep & 500 saplings" },
      ],
      fundingBreakdown: [
        {
          category: "Saplings & Irrigation",
          amount: 25000,
          description: "Native trees & drip lines",
        },
      ],
      measurableImpact: {
        metric: "trees planted",
        targetValue: 2500,
        trackingMethod: "Satellite Imagery Audit",
      },
    },
    impactMetrics: {
      type: "trees",
      unit: "trees",
      targetAmount: 2500,
      currentAmount: 1640,
      perDollar: 0.1,
    },
  },
];

const MOCK_LINKED_ACCOUNTS = [
  {
    id: "acc_plaid_1",
    userId: "usr_demo_1",
    stripeAccountId: "plaid_acc_demo_1",
    plaidAccountId: "plaid_acc_demo_1",
    displayName: "Plaid Sandbox Checking",
    institutionName: "Plaid Sandbox Bank",
    last4: "1234",
    status: "active",
    createdAt: "2026-03-01T12:00:00.000Z",
  },
];

const MOCK_CONTRIBUTIONS = [
  {
    id: "contrib_1",
    userId: "usr_demo_1",
    projectId: "proj_solar_ca",
    projectTitle: "Solar Energy Farm - California",
    amount: 25,
    createdAt: "2026-09-10T12:00:00.000Z",
  },
  {
    id: "contrib_2",
    userId: "usr_demo_1",
    projectId: "proj_urban_forest",
    projectTitle: "Urban Canopy & Heat Reduction",
    amount: 40,
    createdAt: "2026-10-14T12:00:00.000Z",
  },
  {
    id: "contrib_3",
    userId: "usr_demo_1",
    projectId: "proj_solar_ca",
    projectTitle: "Solar Energy Farm - California",
    amount: 15,
    createdAt: "2026-11-05T12:00:00.000Z",
  },
];

function ensureClientBuild() {
  if (process.env.SKIP_BUILD === "1" && fs.existsSync(path.join(DIST_PUBLIC_DIR, "index.html"))) {
    console.log("⏭️  SKIP_BUILD=1 and dist/public exists; skipping Vite build.");
    return;
  }
  console.log("🔨 Building React client bundle (vite build) for deterministic preview server...");
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
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function applyDeterministicStyles(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function setupApiMockRoutes(page: Page, options: { authenticated?: boolean } = {}) {
  const { authenticated = true } = options;

  await page.context().route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname.endsWith("/api/config")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stripeDisabled: false,
          environment: "development",
        }),
      });
    }

    if (pathname.endsWith("/api/locale")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locale: "en-US", currency: "USD" }),
      });
    }

    if (pathname.endsWith("/api/user")) {
      if (!authenticated) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unauthorized" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      });
    }

    if (pathname.endsWith("/api/projects") || pathname.endsWith("/api/my-projects")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROJECTS),
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
        body: JSON.stringify(MOCK_PROJECTS[0]),
      });
    }

    if (pathname.endsWith("/api/user/contributions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CONTRIBUTIONS),
      });
    }

    if (pathname.endsWith("/api/roundup/linked-accounts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LINKED_ACCOUNTS),
      });
    }

    if (pathname.endsWith("/api/roundup/summary")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balanceCents: 385,
          batches: [
            {
              id: "batch_1",
              userId: "usr_demo_1",
              amountCents: 525,
              projectIds: ["proj_solar_ca"],
              donatedAt: "2026-11-01T12:00:00.000Z",
            },
          ],
        }),
      });
    }

    if (pathname.endsWith("/api/roundup/recent-transactions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (pathname.endsWith("/api/organizations")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "org_1", name: "SunGrid Collective", description: "Community solar co-op" },
        ]),
      });
    }

    if (pathname.endsWith("/api/admin/comments/flagged")) {
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

async function generateScreenshots() {
  console.log("🚀 Starting screenshot generation for GreenInitiatives...");

  fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  fs.mkdirSync(PAGES_DIR, { recursive: true });

  ensureClientBuild();

  const { server, baseUrl } = await startStaticSpaServer();
  console.log(`📡 Local preview server running at ${baseUrl}`);

  const savedFiles: string[] = [];
  const browser = await chromium.launch();

  const createPage = async (viewport = { width: 1280, height: 800 }) => {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 2,
      timezoneId: "America/New_York",
      locale: "en-US",
    });
    await page.addInitScript(TSX_NAME_SHIM);
    return page;
  };

  try {
    // 1. Auth Page (unauthenticated)
    const authPage = await createPage();
    await setupApiMockRoutes(authPage, { authenticated: false });
    await authPage.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
    await applyDeterministicStyles(authPage);
    await authPage.screenshot({ path: path.join(PAGES_DIR, "auth-page.png"), fullPage: true });
    savedFiles.push("screenshots/pages/auth-page.png");
    console.log("  ✓ pages/auth-page.png");
    await authPage.close();

    // 2. Desktop Authenticated Pages
    const desktopPage = await createPage();
    await setupApiMockRoutes(desktopPage, { authenticated: true });

    const routesToCapture = [
      { route: "/", file: "home-page.png" },
      { route: "/projects", file: "projects-page.png" },
      { route: "/project/proj_solar_ca", file: "project-details-page.png" },
      { route: "/profile", file: "profile-page.png" },
      { route: "/dashboard", file: "partner-dashboard-page.png" },
    ];

    for (const item of routesToCapture) {
      await desktopPage.goto(`${baseUrl}${item.route}`, { waitUntil: "networkidle" });
      await applyDeterministicStyles(desktopPage);
      await desktopPage.screenshot({ path: path.join(PAGES_DIR, item.file), fullPage: true });
      savedFiles.push(`screenshots/pages/${item.file}`);
      console.log(`  ✓ pages/${item.file}`);
    }

    // 3. Settings Round-Up Tab + Plaid Link Dialog Component
    await desktopPage.goto(`${baseUrl}/settings?tab=roundup`, { waitUntil: "networkidle" });
    await applyDeterministicStyles(desktopPage);
    await desktopPage.screenshot({
      path: path.join(PAGES_DIR, "settings-roundup-page.png"),
      fullPage: true,
    });
    savedFiles.push("screenshots/pages/settings-roundup-page.png");
    console.log("  ✓ pages/settings-roundup-page.png");

    const linkBtn = desktopPage.getByRole("button", { name: /Link Bank Account/i });
    if (await linkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await linkBtn.click();
      const dialog = desktopPage.locator('[role="dialog"]').first();
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      await applyDeterministicStyles(desktopPage);
      await dialog.screenshot({ path: path.join(COMPONENTS_DIR, "plaid-link-dialog.png") });
      savedFiles.push("screenshots/components/plaid-link-dialog.png");
      console.log("  ✓ components/plaid-link-dialog.png");
    }
    await desktopPage.close();

    // 4. Mobile Home Page (390x844)
    const mobilePage = await createPage({ width: 390, height: 844 });
    await setupApiMockRoutes(mobilePage, { authenticated: true });
    await mobilePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await applyDeterministicStyles(mobilePage);
    await mobilePage.screenshot({ path: path.join(PAGES_DIR, "home-mobile.png"), fullPage: true });
    savedFiles.push("screenshots/pages/home-mobile.png");
    console.log("  ✓ pages/home-mobile.png");
    await mobilePage.close();

    console.log(`\n✅ Generated ${savedFiles.length} screenshots.`);
  } finally {
    await browser.close();
    server.close();
  }
}

generateScreenshots().catch((err) => {
  console.error("❌ Screenshot generation failed:", err);
  process.exit(1);
});
