import request from "supertest";
import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { UserModel } from "../models";
import { getApp } from "./utils/test-app";
import { Express } from "express";

/** Extract the token cookie string from a supertest response's Set-Cookie header */
function getTokenCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  const match = setCookie?.find((c: string) => c.startsWith("token="));
  return match?.split(";")[0] || "";
}

describe("Tree Growth API", () => {
  let app: Express;
  let testCookie: string;
  let testUserId: string;

  beforeAll(async () => {
    await connectToMongoDB();
    app = await getApp();
  });

  afterAll(async () => {
    await closeMongoConnection();
  });

  beforeEach(async () => {
    // Create a fresh test user for each test
    const uniqueUsername = `treetest_${Date.now()}`;
    const password = "testpassword";

    const user = await UserModel.create({
      username: uniqueUsername,
      password: password,
      points: 100,
      sunwaterCoins: 50,
      treeGrowth: 0,
      allowedEnvironment: "development",
      roundUpEnabled: false,
      createdAt: new Date(),
    });

    testUserId = user._id.toString();

    // Login to get token cookie
    const loginResponse = await request(app).post("/api/login").send({
      username: uniqueUsername,
      password: password,
    });
    testCookie = getTokenCookie(loginResponse);
  });

  afterEach(async () => {
    // Clean up test user
    if (testUserId) {
      await UserModel.findByIdAndDelete(testUserId);
    }
  });

  describe("POST /api/user/water-tree", () => {
    it("should successfully water tree and deduct coins", async () => {
      const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);

      expect(response.status).toBe(200);

      // Verify coins were deducted (50 initial + 10 login bonus - 10 watering = 50)
      expect(response.body.sunwaterCoins).toBe(50);

      // Verify tree grew
      expect(response.body.treeGrowth).toBe(5); // 0 + 5
    });

    it("should allow multiple waterings and accumulate growth", async () => {
      // Water tree 3 times
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/user/water-tree").set("Cookie", testCookie);
      }

      // Verify final state
      const userResponse = await request(app).get("/api/user").set("Cookie", testCookie);

      expect(userResponse.body.sunwaterCoins).toBe(30); // 50 + 10 login - (3 * 10)
      expect(userResponse.body.treeGrowth).toBe(15); // 0 + (3 * 5)
    });

    it("should fail when user has insufficient coins", async () => {
      // Update user to have only 5 coins
      await UserModel.findByIdAndUpdate(testUserId, { $set: { sunwaterCoins: 5 } });

      const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Not enough sunwater coins");
    });

    it("should fail when user has exactly 9 coins", async () => {
      // Edge case: 9 coins is not enough
      await UserModel.findByIdAndUpdate(testUserId, { $set: { sunwaterCoins: 9 } });

      const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);

      expect(response.status).toBe(400);
    });

    it("should work when user has exactly 10 coins", async () => {
      // Edge case: 10 coins is exactly enough
      await UserModel.findByIdAndUpdate(testUserId, { $set: { sunwaterCoins: 10 } });

      const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);

      expect(response.status).toBe(200);
      expect(response.body.sunwaterCoins).toBe(0); // 10 - 10
      expect(response.body.treeGrowth).toBe(5);
    });

    it("should fail when user is not authenticated", async () => {
      const response = await request(app)
        .post("/api/user/water-tree")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(403); // Invalid token returns 403
    });

    it("should fail when no auth token is provided", async () => {
      const response = await request(app).post("/api/user/water-tree");

      expect(response.status).toBe(401);
    });

    it("should cap tree growth at 100%", async () => {
      // Set tree to 98% growth
      await UserModel.findByIdAndUpdate(testUserId, {
        $set: { treeGrowth: 98, sunwaterCoins: 100 },
      });

      // Water tree (should add 5%, but cap at 100%)
      const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);

      expect(response.body.treeGrowth).toBeLessThanOrEqual(100);
    });

    it("should handle multiple sequential waterings correctly", async () => {
      // Water tree 3 times
      for (let i = 0; i < 3; i++) {
        const response = await request(app).post("/api/user/water-tree").set("Cookie", testCookie);
        expect(response.status).toBe(200);
      }

      // Verify final state
      const userResponse = await request(app).get("/api/user").set("Cookie", testCookie);

      expect(userResponse.body.sunwaterCoins).toBe(30); // 50 + 10 login - (3 * 10)
      expect(userResponse.body.treeGrowth).toBe(15); // 0 + (3 * 5)
    });
  });
});
