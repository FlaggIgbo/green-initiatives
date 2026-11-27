import request from "supertest";
import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { SANDBOX_ADMIN_PASSWORD, DEV_ADMIN_PASSWORD } from "../constants";
import { UserModel } from "../models";
import { getApp } from "./utils/test-app";
import { Express } from "express";

const TEST_ADMIN_USERNAME = "admin_auth_test";

/** Extract the token cookie string from a supertest response's Set-Cookie header */
function getTokenCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  const match = setCookie?.find((c: string) => c.startsWith("token="));
  return match?.split(";")[0] || "";
}

/** Extract just the JWT value from the token cookie */
function getTokenValue(res: request.Response): string {
  const cookie = getTokenCookie(res);
  return cookie.replace("token=", "");
}

describe("Authentication API", () => {
  let app: Express;

  beforeAll(async () => {
    // Connect to MongoDB
    await connectToMongoDB();
    app = await getApp();

    // Ensure admin user exists with correct password
    // Use unique username for this test suite to avoid collisions
    await UserModel.deleteMany({ username: TEST_ADMIN_USERNAME });

    await UserModel.create({
      username: TEST_ADMIN_USERNAME,
      password: SANDBOX_ADMIN_PASSWORD,
      role: "admin",
      points: 0,
      lastLogin: new Date(),
      treeGrowth: 0,
      sunwaterCoins: 0,
      allowedEnvironment: "development", // Tests run in development environment
      roundUpEnabled: false,
      createdAt: new Date(),
    });
  });

  afterAll(async () => {
    await closeMongoConnection();
  });

  describe("POST /api/login", () => {
    it("should successfully authenticate admin user with correct credentials", async () => {
      const response = await request(app).post("/api/login").send({
        username: TEST_ADMIN_USERNAME,
        password: SANDBOX_ADMIN_PASSWORD,
      });

      expect(response.status).toBe(200);

      // Verify response structure
      expect(response.body).toHaveProperty("user");

      // Token is now in an HTTP-only cookie, not in the response body
      const tokenValue = getTokenValue(response);
      expect(tokenValue).toBeTruthy();

      // Verify user data
      expect(response.body.user.username).toBe(TEST_ADMIN_USERNAME);
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).not.toHaveProperty("password"); // Password should not be returned

      // Verify JWT token format (from cookie)
      expect(tokenValue).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // Basic JWT format check
    });

    it("should fail authentication with incorrect password", async () => {
      const response = await request(app).post("/api/login").send({
        username: TEST_ADMIN_USERNAME,
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/invalid/i);
    });

    it("should fail authentication with non-existent user", async () => {
      const response = await request(app).post("/api/login").send({
        username: "nonexistentuser",
        password: "anypassword",
      });

      expect(response.status).toBe(401);
    });

    it("should return a valid JWT token that can be used for authentication", async () => {
      // First, login to get token
      const loginResponse = await request(app).post("/api/login").send({
        username: TEST_ADMIN_USERNAME,
        password: SANDBOX_ADMIN_PASSWORD,
      });

      expect(loginResponse.status).toBe(200);
      const tokenCookie = getTokenCookie(loginResponse);
      expect(tokenCookie).toBeTruthy();

      // Use token cookie to access protected endpoint
      const userResponse = await request(app).get("/api/user").set("Cookie", tokenCookie);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.username).toBe(TEST_ADMIN_USERNAME);
    });
  });

  describe("POST /api/register", () => {
    it("should prevent duplicate username registration", async () => {
      const response = await request(app).post("/api/register").send({
        username: TEST_ADMIN_USERNAME,
        password: "anypassword",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/already exists/i);
    });

    it("should successfully register a new user", async () => {
      const testUsername = `testuser_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
      });

      expect(response.status).toBe(201);
      expect(response.body.user.username).toBe(testUsername);
      // Token is now in an HTTP-only cookie
      expect(getTokenCookie(response)).toBeTruthy();

      // Cleanup: remove test user
      await UserModel.deleteOne({ username: testUsername });
    });
  });

  describe("Admin credentials verification", () => {
    it("should successfully authenticate admin with the unified password '@berrybank1'", async () => {
      // Set password to unified password for this test
      const admin = await UserModel.findOne({ username: TEST_ADMIN_USERNAME });
      if (admin) {
        admin.password = DEV_ADMIN_PASSWORD;
        await admin.save();
      }

      const response = await request(app).post("/api/login").send({
        username: TEST_ADMIN_USERNAME,
        password: DEV_ADMIN_PASSWORD,
      });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe(TEST_ADMIN_USERNAME);
      expect(getTokenCookie(response)).toBeTruthy();
    });

    it("should ALWAYS authenticate admin with @berrybank1 password", async () => {
      // Reset password to sandbox password for this test
      const admin = await UserModel.findOne({ username: TEST_ADMIN_USERNAME });
      if (admin) {
        admin.password = SANDBOX_ADMIN_PASSWORD;
        await admin.save();
      }

      // This is the critical test to ensure admin access is never broken
      const response = await request(app).post("/api/login").send({
        username: TEST_ADMIN_USERNAME,
        password: "@berrybank1",
      });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe(TEST_ADMIN_USERNAME);
      const tokenCookie = getTokenCookie(response);
      expect(tokenCookie).toBeTruthy();

      // Verify token works
      const verifyResponse = await request(app).get("/api/user").set("Cookie", tokenCookie);

      expect(verifyResponse.status).toBe(200);
    });
  });

  describe("Role-Based Access Control", () => {
    it("should register user with default 'user' role when no role specified", async () => {
      const testUsername = `defaultrole_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("user");
      expect(response.body.user.username).toBe(testUsername);

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });

    it("should register user with 'admin' role when specified", async () => {
      const testUsername = `adminrole_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "admin",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("admin");
      expect(response.body.user.username).toBe(testUsername);

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });

    it("should register user with 'entity' role when specified", async () => {
      const testUsername = `entityrole_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "entity",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("entity");
      expect(response.body.user.username).toBe(testUsername);

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });

    it("should register user with explicit 'user' role when specified", async () => {
      const testUsername = `explicitrole_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "user",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("user");
      expect(response.body.user.username).toBe(testUsername);

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });

    it("should reject registration with invalid role", async () => {
      const testUsername = `invalidrole_${Date.now()}`;
      const testPassword = "testpass123";

      const response = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "superuser", // Invalid role
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Invalid role/i);
      expect(response.body.message).toMatch(/admin, user, entity/);
    });

    it("should preserve user role after login", async () => {
      const testUsername = `rolepreserve_${Date.now()}`;
      const testPassword = "testpass123";

      // Register with entity role
      const registerResponse = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "entity",
      });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.role).toBe("entity");

      // Login and verify role is preserved
      const loginResponse = await request(app).post("/api/login").send({
        username: testUsername,
        password: testPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.role).toBe("entity");

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });

    it("should return role in authenticated user endpoint", async () => {
      const testUsername = `roleauth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const testPassword = "testpass123";

      // Register with admin role
      const registerResponse = await request(app).post("/api/register").send({
        username: testUsername,
        password: testPassword,
        role: "admin",
      });

      expect(registerResponse.status).toBe(201);
      const tokenCookie = getTokenCookie(registerResponse);

      // Use token cookie to get user data from authenticated endpoint
      const userResponse = await request(app).get("/api/user").set("Cookie", tokenCookie);

      expect(userResponse.status).toBe(200);

      // Verify authenticated endpoint returns role field
      expect(userResponse.body).toHaveProperty("role");
      expect(userResponse.body.role).toBe("admin");
      expect(userResponse.body.username).toBe(testUsername);

      // Cleanup
      await UserModel.deleteOne({ username: testUsername });
    });
  });
});
