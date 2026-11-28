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
const RECORDINGS_DIR = path.resolve(ROOT_DIR, "recordings");

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
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function setupStatefulMocks(page: Page) {
  let user: {
    id: string;
    email: string;
    roundUpEnabled: boolean;
    selectedBasketId: string;
    roundUpBalanceCents: number;
  } | null = null;
  const accounts: Record<string, unknown>[] = [];
  const recentTransactions: Record<string, unknown>[] = [];

  await page.context().route("**/api/**", (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const method = req.method();
    const body = (req.postDataJSON() as Record<string, unknown>) || {};

    if (pathname === "/api/auth/me") {
      return user
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ user }),
          })
        : route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    }

    if (
      (pathname === "/api/auth/login" || pathname === "/api/auth/register") &&
      method === "POST"
    ) {
      const email = String(body.email || "demo@example.com");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "mfa_required",
          mfaToken: "mfa_e2e_token",
          email,
          hasPasskey: true,
          passkeyOptions: {
            challenge: "ZTNlX2NoYWxsZW5nZQ",
            rpId: "localhost",
            timeout: 60000,
            userVerification: "preferred",
            allowCredentials: [{ id: "Y3JlZF9lMmU", type: "public-key" }],
          },
        }),
      });
    }

    if (pathname === "/api/auth/otp/send" && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sent: true,
          delivery: "console",
          expiresInSeconds: 600,
          devCode: "482910",
        }),
      });
    }

    if (pathname === "/api/auth/otp/verify" && method === "POST") {
      user = {
        id: "usr_e2e",
        email: "demo@example.com",
        roundUpEnabled: true,
        selectedBasketId: "clean-energy-grid",
        roundUpBalanceCents: 450,
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "authenticated", user }),
      });
    }

    if (pathname === "/api/auth/passkeys") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
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
        ]),
      });
    }

    if (pathname === "/api/plaid/exchange" && method === "POST") {
      const acc = {
        id: `acc_${accounts.length + 1}`,
        plaidItemId: "item_e2e",
        plaidAccountId: "acc_e2e",
        institutionName: String(body.institutionName || "Plaid Sandbox Bank"),
        accountName: String(body.accountName || "Checking"),
        mask: String(body.mask || "1234"),
        createdAt: new Date().toISOString(),
      };
      accounts.push(acc);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(acc),
      });
    }

    if (pathname === "/api/plaid/accounts") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(accounts),
      });
    }

    if (pathname === "/api/plaid/sync" && method === "POST") {
      recentTransactions.push({
        id: "t_e2e",
        plaidTransactionId: "plaid_e2e_1",
        merchantName: "Blue Bottle Coffee",
        amountCents: 435,
        roundUpCents: 65,
        date: "2026-11-27",
      });
      if (user) user.roundUpBalanceCents += 65;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          addedCount: 1,
          accruedCents: 65,
          balanceCents: user?.roundUpBalanceCents ?? 0,
        }),
      });
    }

    if (pathname === "/api/roundup/flush" && method === "POST") {
      const investedCents = user?.roundUpBalanceCents ?? 0;
      if (user) user.roundUpBalanceCents = 0;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          investedCents,
          status: "INVESTED",
          orderIds: ["ord_icln", "ord_tan", "ord_nee"],
        }),
      });
    }

    if (pathname === "/api/roundup/summary") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balanceCents: user?.roundUpBalanceCents ?? 0,
          thresholdCents: 500,
          roundUpEnabled: user?.roundUpEnabled ?? true,
          selectedBasketId: user?.selectedBasketId ?? "clean-energy-grid",
          recentTransactions,
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
        ]),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function main() {
  ensureClientBuild();
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const { server, baseUrl } = await startStaticServer();
  const isHeadless = process.env.HEADLESS === "true" || process.env.CI === "true";
  const browser = await chromium.launch({ headless: isHeadless, slowMo: isHeadless ? 0 : 250 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: RECORDINGS_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  await page.addInitScript(TSX_NAME_SHIM);

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    await setupStatefulMocks(page);

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.fill("#email", "demo@example.com");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: /^Sign In$/i }).click();

    // Passkey fails in headless without authenticator -> automatic Email OTP fallback
    await page.locator("#otp-code").waitFor({ timeout: 10000 });
    await page.fill("#otp-code", "482910");
    await page.getByRole("button", { name: /Verify Email Code/i }).click();
    await page.getByText(/ESG Portfolio \(Alpaca\)/i).waitFor({ timeout: 10000 });

    // Link bank via Plaid
    await page.getByRole("button", { name: /Bank & ESG Basket/i }).click();
    await page.getByRole("button", { name: /Link Bank with Plaid/i }).click();
    await page.getByRole("button", { name: /Plaid Sandbox Bank/i }).click();
    await page.getByText(/Plaid Sandbox Bank — Checking/i).waitFor({ timeout: 10000 });

    // Sync Plaid transactions & Invest via Alpaca
    await page.getByRole("button", { name: /^Portfolio$/i }).click();
    await page.getByRole("button", { name: /Sync Plaid Transactions/i }).click();
    await page.getByText(/Blue Bottle Coffee/i).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Invest via Alpaca/i }).click();
    await page.getByText(/Submitted \$5\.15 to Alpaca/i).waitFor({ timeout: 10000 });

    if (pageErrors.length > 0) {
      throw new Error(`Uncaught page errors:\n${pageErrors.join("\n")}`);
    }
    console.log("✅ Playwright E2E flow passed!");
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    server.close();
    if (video) {
      const rawPath = await video.path();
      const target = path.join(RECORDINGS_DIR, "e2e-playwright-flow.webm");
      fs.renameSync(rawPath, target);
      console.log(`🎥 Saved recording: ${target}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ E2E flow failed:", err);
  process.exit(1);
});
