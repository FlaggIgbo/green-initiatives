import app, { errorHandler } from "../../app";
import { registerRoutes } from "../../routes";
import { Express } from "express";

let appWithRoutes: Express;

export async function getApp(): Promise<Express> {
  if (appWithRoutes) {
    return appWithRoutes;
  }

  // Register routes on the app
  await registerRoutes(app);

  // Add error handler
  app.use(errorHandler);

  appWithRoutes = app;
  return appWithRoutes;
}
