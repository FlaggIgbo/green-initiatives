import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./mongo/storage";
import { User } from "../shared/schema-mongo";
import { detectEnvironment, type RequestWithEnvironment } from "./environment";
import { logger } from "./logger";
import {
  ADMIN_USERNAME,
  SANDBOX_ADMIN_PASSWORD,
  DEV_ADMIN_PASSWORD,
  JWT_SECRET,
} from "./constants";

// Exporting constants for tests that import from this file
export { ADMIN_USERNAME, SANDBOX_ADMIN_PASSWORD, DEV_ADMIN_PASSWORD };

// Add user to Express Request
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

// Verify JWT token and return decoded payload
function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

// JWT authentication middleware
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  try {
    const currentEnv = (req as RequestWithEnvironment).environment || detectEnvironment(req);

    // Get user from DB
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate environment access
    if (currentEnv && user.allowedEnvironment && user.allowedEnvironment !== currentEnv) {
      logger.warn("Environment mismatch for user", {
        userId: user.id,
        userEnv: user.allowedEnvironment,
        currentEnv,
      });
      return res.status(403).json({
        message: "User does not have access to this environment",
        environment: currentEnv,
        userEnvironment: user.allowedEnvironment,
      });
    }

    // Attach user to req
    const { password: _, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (_error) {
    res.status(500).json({ message: "Authentication error" });
  }
}
