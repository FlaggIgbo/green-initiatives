import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium, type Page } from "playwright";

const TSX_NAME_SHIM = "globalThis.__name = globalThis.__name || ((fn) => fn);";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_PUBLIC_DIR = path.resolve(ROOT_DIR, "dist/public");
const PAGES_DIR = path.resolve(ROOT_DIR, "screenshots/pages");
const COMPONENTS_DIR = path.resolve(ROOT_DIR, "screenshots/components");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function ensureClientBuild() {
  if (process.env.SKIP_BUILD === "1" && fs.existsSync(path.join(DIST_PUBLIC_DIR, "index.html"))) {
    return;
  }
  execSync("npx vite build", { cwd: ROOT_DIR, stdio: "pipe" });
}

function startStaticServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
      let filePath = path.join(DIST_PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_PUBLIC_DIR, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 4173;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function setupMocks(page: Page, authenticated: boolean) {
  await page.context().route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === "/api/auth/me") {
      return authenticated
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              user: {
                id: "usr_1",
                email: "alex@example.com",
                roundUpEnabled: true,
                selectedBasketId: "clean-energy-grid",
                roundUpBalanceCents: 385,
              },
            }),
          })
        : route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    }

    if (pathname === "/api/baskets") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "clean-energy-grid",
            name: "Clean Energy & Grid",
            description: "Solar, clean energy infrastructure, and renewable utilities",
            holdings: [
              { symbol: "ICLN", name: "iShares Global Clean Energy ETF", weight: 0.4 },
              { symbol: "TAN", name: "Invesco Solar ETF", weight: 0.3 },
              { symbol: "NEE", name: "NextEra Energy", weight: 0.3 },
            ],
          },
          {
            id: "broad-esg-core",
            name: "Broad ESG Core",
            description: "Diversified US large-cap ESG screened equities",
            holdings: [
              { symbol: "ESGU", name: "iShares ESG Aware MSCI USA ETF", weight: 0.6 },
              { symbol: "USSG", name: "Xtrackers MSCI USA ESG Leaders ETF", weight: 0.4 },
            ],
          },
          {
            id: "water-circular-economy",
            name: "Water & Circular Economy",
            description: "Water infrastructure and waste/recycling leaders",
            holdings: [
              { symbol: "PHO", name: "Invesco Water Resources ETF", weight: 0.5 },
              { symbol: "WM", name: "Waste Management", weight: 0.5 },
            ],
          },
        ]),
      });
    }

    if (pathname === "/api/plaid/accounts") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "acc_1",
            plaidItemId: "item_1",
            plaidAccountId: "acc_plaid_1",
            institutionName: "Plaid Sandbox Bank",
            accountName: "Checking",
            mask: "1234",
            createdAt: "2026-11-01T12:00:00.000Z",
          },
        ]),
      });
    }

    if (pathname === "/api/roundup/summary") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balanceCents: 385,
          thresholdCents: 500,
          roundUpEnabled: true,
          selectedBasketId: "clean-energy-grid",
          recentTransactions: [
            {
              id: "t1",
              plaidTransactionId: "plaid_1",
              merchantName: "Blue Bottle Coffee",
              amountCents: 435,
              roundUpCents: 65,
              date: "2026-11-26",
            },
            {
              id: "t2",
              plaidTransactionId: "plaid_2",
              merchantName: "Trader Joe's",
              amountCents: 2840,
              roundUpCents: 60,
              date: "2026-11-25",
            },
          ],
          ledgerEntries: [],
        }),
      });
    }

    if (pathname === "/api/portfolio/positions") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            symbol: "ICLN",
            qty: 1.42,
            avgEntryPrice: 14.1,
            marketValue: 21.3,
            unrealizedPl: 1.28,
            unrealizedPlPct: 6.39,
          },
          {
            symbol: "TAN",
            qty: 0.36,
            avgEntryPrice: 41.2,
            marketValue: 15.84,
            unrealizedPl: 1.01,
            unrealizedPlPct: 6.81,
          },
          {
            symbol: "NEE",
            qty: 0.21,
            avgEntryPrice: 71.5,
            marketValue: 15.75,
            unrealizedPl: 0.74,
            unrealizedPlPct: 4.93,
          },
        ]),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function main() {
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  ensureClientBuild();

  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch();

  const newPage = async (viewport = { width: 1280, height: 800 }) => {
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
    // 1. Auth page
    const authPage = await newPage();
    await setupMocks(authPage, false);
    await authPage.goto(baseUrl, { waitUntil: "networkidle" });
    await authPage.screenshot({ path: path.join(PAGES_DIR, "auth-page.png"), fullPage: true });
    console.log("  ✓ screenshots/pages/auth-page.png");
    await authPage.close();

    // 2. Portfolio page + Settings page + Plaid dialog
    const page = await newPage();
    await setupMocks(page, true);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(PAGES_DIR, "portfolio-page.png"), fullPage: true });
    console.log("  ✓ screenshots/pages/portfolio-page.png");

    await page.getByRole("button", { name: /Bank & ESG Basket/i }).click();
    await page.screenshot({ path: path.join(PAGES_DIR, "settings-page.png"), fullPage: true });
    console.log("  ✓ screenshots/pages/settings-page.png");

    await page.getByRole("button", { name: /Link Bank with Plaid/i }).click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible" });
    await dialog.screenshot({ path: path.join(COMPONENTS_DIR, "plaid-link-dialog.png") });
    console.log("  ✓ screenshots/components/plaid-link-dialog.png");
    await page.close();

    // 3. Mobile Portfolio
    const mobile = await newPage({ width: 390, height: 844 });
    await setupMocks(mobile, true);
    await mobile.goto(baseUrl, { waitUntil: "networkidle" });
    await mobile.screenshot({ path: path.join(PAGES_DIR, "portfolio-mobile.png"), fullPage: true });
    console.log("  ✓ screenshots/pages/portfolio-mobile.png");
    await mobile.close();

    console.log("✅ Generated 5 screenshots.");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("❌ Screenshot generation failed:", err);
  process.exit(1);
});
