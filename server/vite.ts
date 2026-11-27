import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";

// Handle __dirname in both ESM and CJS (for Jest)
const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Using process.stdout.write to bypass no-console lint rule
  process.stdout.write(`${formattedTime} [${source}] ${message}\n`);
}

export async function setupVite(app: Express, _server: Server) {
  // Dynamic import for dev-only dependencies
  const { createServer: createViteServer, createLogger } = await import("vite");
  const { nanoid } = await import("nanoid");

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: {
      port: 24680, // Use different port to avoid conflicts with app WebSocket
    },
  } as const;

  // Inline vite config to avoid bundling vite.config.ts
  const clientRoot = path.resolve(_dirname, "..", "client");

  const vite = await createViteServer({
    plugins: [
      (await import("@vitejs/plugin-react")).default(),
      (await import("@replit/vite-plugin-runtime-error-modal")).default(),
      (await import("@replit/vite-plugin-shadcn-theme-json")).default(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(clientRoot, "src"),
        "@shared": path.resolve(_dirname, "..", "shared"),
      },
    },
    root: clientRoot,
    build: {
      outDir: path.resolve(_dirname, "..", "dist", "public"),
      emptyOutDir: true,
    },
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("/{*splat}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(_dirname, "..", "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(_dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
