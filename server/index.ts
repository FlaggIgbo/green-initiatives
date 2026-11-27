import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./db";
import { createApiRouter } from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);

async function start() {
  await connectDb();

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api", createApiRouter());

  // Serve built Vite SPA in production or use Vite middleware in development
  const distPublic = path.resolve(__dirname, "../dist/public");
  if (process.env.NODE_ENV === "production" && fs.existsSync(distPublic)) {
    app.use(express.static(distPublic));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPublic, "index.html"));
    });
  } else if (process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.info(`[server] Listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
