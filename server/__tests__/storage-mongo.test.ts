import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { storage } from "../mongo/storage";
import { ENVIRONMENTS, USER_ROLES } from "../../shared/schema-mongo";

describe("Storage Mongo Integration Tests", () => {
  beforeAll(async () => {
    await connectToMongoDB();
  });

  afterAll(async () => {
    await closeMongoConnection();
  });

  describe("User Operations", () => {
    it("should create and retrieve a user", async () => {
      const username = `testuser_${Date.now()}`;
      const userData = {
        username,
        password: "hashedpassword",
        role: USER_ROLES.user,
      };

      const user = await storage.createUser(userData, ENVIRONMENTS.development);
      expect(user).toBeDefined();
      expect(user.username).toBe(username);

      const retrievedUser = await storage.getUser(user.id);
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.username).toBe(username);
    });

    it("should find a user by username", async () => {
      const username = `findme_${Date.now()}`;
      await storage.createUser({
        username,
        password: "password123",
        role: USER_ROLES.user,
      });

      const user = await storage.getUserByUsername(username);
      expect(user).toBeDefined();
      expect(user?.username).toBe(username);
    });
  });

  describe("Organization Operations", () => {
    it("should create and retrieve organizations", async () => {
      const orgName = `Test Org ${Date.now()}`;
      const org = await storage.createOrganization({
        name: orgName,
        description: "Test description",
        website: "https://test.com",
      });

      expect(org).toBeDefined();
      expect(org.name).toBe(orgName);

      const orgs = await storage.getOrganizations();
      expect(orgs.some((o) => o.name === orgName)).toBe(true);
    });
  });
});
