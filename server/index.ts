import "dotenv/config";
import app, { errorHandler } from "./app";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebSocket } from "./websocket";
import { connectToMongoDB } from "./connect/mongodb";
import { seedMockData } from "./mock-data";
import { logCorsConfig } from "./cors";
import { ENVIRONMENTS, type Environment } from "@shared/schema-mongo";
import { logger } from "./logger";

(async () => {
  // Determine environment immediately
  const nodeEnv = process.env.NODE_ENV || "development";
  let environment: Environment;

  if (nodeEnv === "production" || nodeEnv === "prod") {
    environment = ENVIRONMENTS.production;
  } else if (nodeEnv === "sandbox") {
    environment = ENVIRONMENTS.sandbox;
  } else {
    environment = ENVIRONMENTS.development;
  }

  logger.info(`[Server] Starting in ${nodeEnv} mode`, { environment });

  // Connect to MongoDB in the background (non-blocking for server startup)
  connectToMongoDB()
    .then(async () => {
      logger.info("Connected to MongoDB successfully");

      // Seed mock data after connection is established
      // Skip automatic seeding in production or test environments
      const isProduction =
        environment === ENVIRONMENTS.production ||
        process.env.NODE_ENV === "production" ||
        process.env.NODE_ENV === "prod";

      if (!isProduction) {
        try {
          await seedMockData(environment);
          logger.info("Mock data seeding completed", { environment });
        } catch (error) {
          logger.warn("Failed to seed mock data", {
            environment,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })
    .catch((error) => {
      logger.critical("Failed to connect to MongoDB", {
        error: error instanceof Error ? error.message : String(error),
      });
      // In production, we still want to fail if the primary DB is unreachable
      if (nodeEnv === "production") {
        process.exit(1);
      }
    });

  const server = await registerRoutes(app);

  setupWebSocket(server);

  app.use(errorHandler);

  // In development, use Vite for HMR
  // In production/sandbox, only serve static files if SERVE_STATIC is not explicitly disabled
  // In CI/Test mode, we also want to serve the UI for Playwright
  if (app.get("env") === "development" || (app.get("env") === "test" && process.env.CI)) {
    await setupVite(app, server);
  } else if (app.get("env") !== "test" && process.env.SERVE_STATIC !== "false") {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "8000", 10);
  // In production (especially Cloud Run), bind to 0.0.0.0 to accept external connections
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on port ${port} (host: ${host})`);
    logCorsConfig();
  });
})();
