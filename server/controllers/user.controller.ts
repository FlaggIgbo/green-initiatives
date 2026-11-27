import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { storage } from "../mongo/storage";
import { authService } from "../services/auth.service";
import { USER_ROLES, ENVIRONMENTS, SUPPORTED_CURRENCIES } from "../../shared/schema-mongo";
import { RequestWithEnvironment, detectEnvironment } from "../environment";
import { emailService } from "../services/email.service";
import { logger } from "../logger";
import {
  ADMIN_USERNAME,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COINS_PER_WATER,
  GROWTH_PER_WATER,
} from "../constants";

export class UserController {
  private generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Cross-origin cookie required when client and server are on different origins
   * (e.g. Cloud Run: client-sandbox.run.app vs server-sandbox.run.app).
   * Both sandbox and production use separate client/server URLs.
   */
  private getCookieOptions(): { httpOnly: true; secure: boolean; sameSite: "lax" | "none" } {
    const isDeployed = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "sandbox";
    return {
      httpOnly: true,
      secure: isDeployed,
      sameSite: isDeployed ? "none" : "lax",
    };
  }

  private setTokenCookie(res: Response, token: string) {
    res.cookie("token", token, {
      ...this.getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matching JWT_EXPIRES_IN)
    });
  }

  register = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const currentEnv = req.environment || detectEnvironment(req);
    const { username, password, fullName, email, phoneNumber, role } = req.body;

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      res.status(400).json({ message: "Username already exists" });
      return;
    }

    // Create new user - password will be hashed by Mongoose pre-save hook
    // This now works in Dev/Sandbox via mongodb-memory-server
    const user = await storage.createUser(
      {
        username,
        password,
        fullName,
        email,
        phoneNumber,
        role: role || USER_ROLES.user,
      },
      currentEnv,
    );

    // Return user & token in cookie
    const token = this.generateToken(user.id);
    this.setTokenCookie(res, token);

    const { password: _, ...userWithoutPassword } = user;

    // Token is set in httpOnly cookie only — do not return in body (reduces exposure in Network tab)
    res.status(201).json({
      user: userWithoutPassword,
    });
  });

  registerEntity = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const currentEnv = req.environment || detectEnvironment(req);
    const { username, password, fullName, email, phoneNumber, orgName, orgDescription, website } =
      req.body;

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      res.status(400).json({ message: "Username already exists" });
      return;
    }

    // Use authService to register entity and organization
    const { user, organization } = await authService.registerEntity(
      {
        user: {
          username,
          password,
          fullName,
          email,
          phoneNumber,
        },
        orgName,
        orgDescription,
        website,
      },
      currentEnv,
    );

    // Set cookie
    const token = this.generateToken(user.id);
    this.setTokenCookie(res, token);

    const { password: _, ...userWithoutPassword } = user;

    // Token is set in httpOnly cookie only — do not return in body
    res.status(201).json({
      user: userWithoutPassword,
      organization,
    });
  });

  login = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const { username, password } = req.body;

    const currentEnv = req.environment || detectEnvironment(req);
    const isSandbox = currentEnv === ENVIRONMENTS.sandbox;

    logger.info("Login attempt initiated", { username, environment: currentEnv });

    // DB login
    const user = await storage.getUserByUsername(username);
    if (!user) {
      if (isSandbox && username !== ADMIN_USERNAME) {
        res.status(401).json({
          message: "In sandbox, only the demo admin account is available. Use username: admin",
        });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
      return;
    }

    const isPasswordValid = await authService.comparePasswords(password, user.password as string);
    if (!isPasswordValid) {
      logger.warn("Login rejected: Invalid credentials", { username });
      if (isSandbox && username === ADMIN_USERNAME) {
        res.status(401).json({
          message: "Invalid password. Hint: The sandbox demo password starts with '@'",
        });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
      return;
    }

    // Sandbox login restriction for non-admin
    if (isSandbox && user.role !== USER_ROLES.admin) {
      logger.warn("Sandbox login attempted with non-admin user", {
        environment: currentEnv,
        attemptedUsername: username,
      });
      res.status(401).json({
        message: "In sandbox, only the demo admin account is available. Use username: admin",
      });
      return;
    }

    // Update stats
    const updatedUser = await storage.updateUserLoginStreak(user.id);

    // OTP Requirement Check (if enabled)
    // In development/sandbox, we trigger it even if email is missing to test the UI flow
    const isOTPEnabled = process.env.EMAIL_OTP_ENABLED === "true";
    const isMockEnv = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "sandbox";

    if (isOTPEnabled && (updatedUser.email || isMockEnv)) {
      const otp = await authService.generateOTP();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await storage.setOTP(updatedUser.id, otp, expires);

      // emailService.sendOTPEmail handles its own dev-mode logging
      await emailService.sendOTPEmail(updatedUser.email || "mock-testing@internal.null", otp);

      logger.info("OTP challenge triggered", { userId: updatedUser.id });

      res.json({
        requiresOTP: true,
        userId: updatedUser.id,
        message: isMockEnv
          ? "MOCK ENVIRONMENT: Use code 111111"
          : "A verification code has been sent to your email.",
      });
      return;
    }

    // Set cookie (Normal Flow)
    const token = this.generateToken(updatedUser.id);
    this.setTokenCookie(res, token);

    const { password: _, ...userWithoutPassword } = updatedUser;

    logger.info("Login successful", { userId: updatedUser.id, username: updatedUser.username });

    // Token is set in httpOnly cookie only — do not return in body (reduces exposure in Network tab)
    res.json({
      user: userWithoutPassword,
    });
  });

  verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      res.status(400).json({ message: "User ID and OTP are required" });
      return;
    }

    const user = await authService.verifyOTP(userId, otp);
    if (!user) {
      logger.warn("OTP verification rejected: Invalid or expired code", { userId });
      res.status(401).json({ message: "Invalid or expired verification code" });
      return;
    }

    logger.info("OTP verification successful", { userId });

    // OTP verified, now finalize login
    const token = this.generateToken(user.id);
    this.setTokenCookie(res, token);

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
    });
  });

  resendOTP = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    const user = await storage.getUser(userId);
    if (!user || !user.email) {
      res.status(404).json({ message: "User not found or has no email" });
      return;
    }

    const otp = await authService.generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await storage.setOTP(user.id, otp, expires);

    await emailService.sendOTPEmail(user.email, otp);

    res.json({ message: "Verification code resent successfully" });
  });

  logout = (req: Request, res: Response) => {
    res.clearCookie("token", this.getCookieOptions());
    res.json({ message: "Logged out successfully" });
  };

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      // Not logged in — return 200 with null so the client can distinguish
      // "no session" (expected) from a real error (4xx/5xx).
      res.json(null);
      return;
    }

    // req.user already has the transformed user object with id field from auth middleware
    res.json(req.user);
  });

  getContributions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const contributions = await storage.getUserContributions(req.user.id);
    res.json(contributions);
  });

  waterTree = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userId = req.user.id;
    const fullUser = await storage.getUser(userId);

    if (!fullUser || (fullUser.sunwaterCoins || 0) < COINS_PER_WATER) {
      res.status(400).json({ error: "Not enough sunwater coins" });
      return;
    }

    // Deduct coins and increase tree growth
    await storage.updateSunwaterCoins(userId, -COINS_PER_WATER);
    const updatedUser = await storage.updateTreeGrowth(userId, GROWTH_PER_WATER);

    res.json(updatedUser);
  });

  updateRoundUpSettings = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { enabled, projectId, projectIds } = req.body;

    const updatedUser = await storage.updateRoundUpSettings(
      req.user.id,
      enabled,
      projectId,
      projectIds,
    );
    res.json(updatedUser);
  });

  updatePreferredCurrency = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { preferredCurrency } = req.body;
    if (!preferredCurrency || !SUPPORTED_CURRENCIES.includes(preferredCurrency)) {
      res.status(400).json({
        error: "Invalid currency",
        supported: [...SUPPORTED_CURRENCIES],
      });
      return;
    }

    const updatedUser = await storage.updatePreferredCurrency(req.user.id, preferredCurrency);
    res.json(updatedUser);
  });

  forgotPassword = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const currentEnv = req.environment || detectEnvironment(req);
    if (currentEnv === ENVIRONMENTS.sandbox || currentEnv === ENVIRONMENTS.development) {
      res.status(403).json({
        message: "Password reset is not available in sandbox or development environments.",
      });
      return;
    }

    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    await authService.initiatePasswordReset(email, req.get("origin") || "");

    // For security reasons, don't reveal if user exists
    res
      .status(200)
      .json({ message: "If a user with that email exists, a reset link has been sent." });
  });

  resetPassword = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const currentEnv = req.environment || detectEnvironment(req);
    if (currentEnv === ENVIRONMENTS.sandbox || currentEnv === ENVIRONMENTS.development) {
      res.status(403).json({
        message: "Password reset is not available in sandbox or development environments.",
      });
      return;
    }

    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: "Token and password are required" });
      return;
    }

    const success = await authService.resetPassword(token, password);
    if (!success) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    res.status(200).json({ message: "Password reset successful" });
  });
}

export const userController = new UserController();
