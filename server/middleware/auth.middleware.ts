import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models";
import { transformDoc } from "../mongo/storage";
import { JWT_SECRET } from "../constants";

/**
 * Optional auth middleware — attempts to authenticate but does NOT reject
 * unauthenticated requests.  Sets `req.user` when a valid session exists;
 * otherwise leaves it `undefined` and calls `next()`.
 *
 * Use this for endpoints that should return a 200 whether or not the caller
 * is logged in (e.g. GET /api/user session-check on page load).
 */
export const optionalProtect = async (req: Request, _res: Response, next: NextFunction) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await UserModel.findById(decoded.userId);

      if (user) {
        const transformed = transformDoc(user) as Record<string, unknown>;
        delete transformed.password;
        req.user = transformed as unknown as typeof req.user;
      }
    } catch {
      // Token is invalid/expired — treat as unauthenticated (req.user stays undefined)
    }
  }

  next();
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // 1. Check for token in cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization header (for mobile)
  else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      // Regular MongoDB user (includes mongodb-memory-server in Dev/Sandbox)
      const user = await UserModel.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      // Transform and strip password — never expose password hash to client
      const transformed = transformDoc(user) as Record<string, unknown>;
      delete transformed.password;
      req.user = transformed as unknown as typeof req.user;

      next();
    } catch (_error: unknown) {
      return res.status(403).json({ message: "Not authorized, token invalid" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

/**
 * RBAC Middleware to restrict access based on user roles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user missing" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Role '${req.user.role}' does not have access to this resource`,
      });
    }

    next();
  };
};
