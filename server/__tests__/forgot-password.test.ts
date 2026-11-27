import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { UserModel } from "../models";
import { authService } from "../services/auth.service";
import { storage } from "../mongo/storage";

describe("Forgot Password Service Logic", () => {
  const testEmail = "test-reset@berrybank.com";
  const testUsername = "reset_test_user";
  let userId: string;

  beforeAll(async () => {
    await connectToMongoDB();

    // Cleanup and create test user
    await UserModel.deleteMany({ email: testEmail });
    const user = await storage.createUser({
      username: testUsername,
      password: "originalPassword123",
      email: testEmail,
      role: "user",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await UserModel.deleteOne({ _id: userId });
    await closeMongoConnection();
  });

  it("should generate a reset token and store it in the database", async () => {
    const origin = "http://localhost:3000";
    const resetUrl = await authService.initiatePasswordReset(testEmail, origin);

    expect(resetUrl).toBeTruthy();
    expect(resetUrl).toContain("token=");

    // Verify token exists in DB
    const user = await storage.getUser(userId);
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.resetPasswordExpires).toBeInstanceOf(Date);
    expect(user.resetPasswordExpires?.getTime()).toBeGreaterThan(Date.now());
  });

  it("should return null if email does not exist", async () => {
    const resetUrl = await authService.initiatePasswordReset(
      "nonexistent@void.com",
      "http://localhost:3000",
    );
    expect(resetUrl).toBeNull();
  });

  it("should successfully reset password with a valid token", async () => {
    // 1. Initiate reset to get a token
    const origin = "http://localhost:3000";
    const resetUrl = await authService.initiatePasswordReset(testEmail, origin);
    const token = new URL(resetUrl!).searchParams.get("token")!;

    // 2. Perform reset
    const newPassword = "newSecurePassword456";
    const success = await authService.resetPassword(token, newPassword);

    expect(success).toBe(true);

    // 3. Verify password is changed and token is cleared
    const updatedUser = await storage.getUser(userId);
    expect(updatedUser.resetPasswordToken).toBeFalsy();

    const isMatch = await authService.comparePasswords(newPassword, updatedUser.password as string);
    expect(isMatch).toBe(true);
  });

  it("should fail to reset password with an invalid token", async () => {
    const success = await authService.resetPassword("invalid-token", "somePassword");
    expect(success).toBe(false);
  });
});
