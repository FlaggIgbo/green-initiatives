import request from "supertest";
import { ADMIN_USERNAME, SANDBOX_ADMIN_PASSWORD } from "../constants";
import { getApp } from "./utils/test-app";
import { Express } from "express";
import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { UserModel } from "../models";

/** Extract the token cookie string from a supertest response's Set-Cookie header */
function getTokenCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  const match = setCookie?.find((c: string) => c.startsWith("token="));
  return match?.split(";")[0] || "";
}

describe("Routes Registration Integration Tests", () => {
  let app: Express;
  let authCookie: string;

  beforeAll(async () => {
    await connectToMongoDB();
    app = await getApp();

    // Ensure admin user exists for tests
    const existingAdmin = await UserModel.findOne({ username: ADMIN_USERNAME });
    if (existingAdmin) {
      existingAdmin.password = SANDBOX_ADMIN_PASSWORD;
      existingAdmin.role = "admin";
      existingAdmin.allowedEnvironment = "development";
      await existingAdmin.save();
    } else {
      await UserModel.create({
        username: ADMIN_USERNAME,
        password: SANDBOX_ADMIN_PASSWORD,
        role: "admin",
        allowedEnvironment: "development",
      });
    }

    // Login to get authentication token for protected endpoints
    const loginResponse = await request(app).post("/api/login").send({
      username: ADMIN_USERNAME,
      password: SANDBOX_ADMIN_PASSWORD,
    });

    if (loginResponse.status !== 200) {
      console.error("Login failed in routes.test.ts setup:", loginResponse.body);
    }

    authCookie = getTokenCookie(loginResponse);
  }, 60_000);

  afterAll(async () => {
    await closeMongoConnection();
  });

  it("should return healthy status from /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("should have API routes registered (e.g., /api/environment)", async () => {
    const res = await request(app).get("/api/environment").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("environment");
  });

  it("should have locale route registered", async () => {
    const res = await request(app).get("/api/locale").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("locale");
  });
});
