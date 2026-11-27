import type { Request, Response, NextFunction } from "express";
import { ENVIRONMENTS, type Environment } from "@shared/schema-mongo";

/**
 * Detects the current environment based on:
 * - localhost → development
 * - query parameter env=sandbox → sandbox
 * - default → production
 */
export function detectEnvironment(req: Request): Environment {
  // 1. Check query parameter first (allows overriding for testing)
  const envParam = req.query.env as string | undefined;
  if (envParam === ENVIRONMENTS.sandbox) {
    return ENVIRONMENTS.sandbox;
  }
  if (envParam === ENVIRONMENTS.production) {
    return ENVIRONMENTS.production;
  }

  // 2. Check process.env.NODE_ENV (standard for cloud deployments)
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === ENVIRONMENTS.sandbox) {
    return ENVIRONMENTS.sandbox;
  }
  if (nodeEnv === ENVIRONMENTS.production) {
    return ENVIRONMENTS.production;
  }

  // 3. Check if running on localhost or in test environment
  const host = req.get("host") || "";
  const isLocal =
    host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0");
  const isTest = nodeEnv === ENVIRONMENTS.test;

  if (isLocal || isTest) {
    return ENVIRONMENTS.development;
  }

  // Default to production
  return ENVIRONMENTS.production;
}

/**
 * Extended Request type with environment property
 */
export interface RequestWithEnvironment extends Request {
  environment?: Environment;
}

/**
 * Middleware to attach environment to request
 */
export function environmentMiddleware(req: Request, res: Response, next: NextFunction) {
  // Attach environment to request object
  (req as RequestWithEnvironment).environment = detectEnvironment(req);
  next();
}
