import crypto from "crypto";
import bcrypt from "bcryptjs";
import { storage } from "../mongo/storage";
import {
  type InsertUser,
  type Organization,
  type User,
  type Environment,
  USER_ROLES,
} from "@shared/schema-mongo";
import { logger } from "../logger";
import { RESET_TOKEN_EXPIRY_MS } from "../constants";

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    return await bcrypt.compare(supplied, stored);
  }

  async registerEntity(
    data: {
      user: InsertUser;
      orgName: string;
      orgDescription: string;
      website?: string;
    },
    environment?: Environment,
  ): Promise<{ user: User; organization: Organization }> {
    // 1. Create Organization
    const organization = await storage.createOrganization({
      name: data.orgName,
      description: data.orgDescription,
      website: data.website || undefined,
    });

    // 2. Create User linked to Organization
    const user = await storage.createUser(
      {
        ...data.user,
        role: USER_ROLES.entity,
        organizationId: organization.id,
      },
      environment,
    );

    return { user, organization };
  }

  async initiatePasswordReset(email: string, origin: string): Promise<string | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) return null;

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await storage.setResetToken(user.id, resetToken, resetExpires);

    const resetUrl = `${origin}/reset-password?token=${resetToken}`;
    logger.info("PASSWORD RESET LINK (SIMULATED):", {
      email: user.email,
      url: resetUrl,
    });

    return resetUrl;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await storage.getUserByResetToken(token);
    if (!user) return false;

    const passwordHash = await this.hashPassword(newPassword);
    await storage.resetPassword(user.id, passwordHash);

    logger.info("User password reset successfully", { userId: user.id });
    return true;
  }

  /**
   * Generates a 6-digit numeric OTP.
   * In development and sandbox, returns a static '111111' for easier testing.
   */
  async generateOTP(): Promise<string> {
    const isMockEnv = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "sandbox";

    if (isMockEnv) {
      return "111111";
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Saves and verifies OTP.
   */
  async verifyOTP(userId: string, otp: string): Promise<User | null> {
    const user = await storage.getUserByOTP(userId, otp);
    if (user) {
      await storage.clearOTP(userId);
      return user;
    }
    return null;
  }
}

export const authService = new AuthService();
