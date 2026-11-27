import request from "supertest";
import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";
import { UserModel, ProjectModel, OrganizationModel } from "../models";
import { getApp } from "./utils/test-app";
import { Express } from "express";
import { UserRole } from "../../shared/schema-mongo";

/** Extract the token cookie string from a supertest response's Set-Cookie header */
function getTokenCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  const match = setCookie?.find((c: string) => c.startsWith("token="));
  return match?.split(";")[0] || "";
}

const TEST_PROPOSAL = {
  objectives:
    "The primary objective of this project is to restore 100 hectares of degraded forest land by planting over 50,000 native tree species. This will enhance local biodiversity, provide habitat for endangered wildlife, and sequester approximately 10,000 tons of carbon dioxide over the next decade. We aim to engage 500 local community members in sustainable forestry practices, creating green jobs and improving local livelihoods.",
  methodology:
    "Our methodology involves a community-led approach starting with the establishment of three native species nurseries. We will use GPS mapping to identify optimal planting sites based on soil quality and water availability. Planting will occur during the monsoon season to maximize survival rates. We will implement a three-year maintenance program including weeding, mulching, and fire protection, with regular survival monitoring and data logging using IoT-enabled field sensors.",
  timeline: [
    {
      phase: "Phase 1: Nursery Establishment",
      duration: "3 months",
      deliverables: "Three nurseries built and 20,000 seedlings germinated",
    },
  ],
  fundingBreakdown: [
    {
      category: "Equipment & Supplies",
      amount: 5000,
      description: "Cost for seedlings, soil, GPS units, and IoT sensors",
    },
  ],
  measurableImpact: {
    metric: "Trees planted",
    targetValue: 100,
    trackingMethod: "Manual count and GPS tracking",
  },
  supportingDocuments: [],
};

describe("Projects API Integration Tests", () => {
  let app: Express;

  // Test users
  const adminUser = {
    username: "test_admin_projects",
    password: "testpass123",
    role: "admin",
  };
  const entityUser = {
    username: "test_entity_projects",
    password: "testpass123",
    role: "entity",
  };
  const regularUser = {
    username: "test_user_projects",
    password: "testpass123",
    role: "user",
  };

  let adminCookie: string;
  let entityCookie: string;
  let regularCookie: string;
  let testOrgId: string;

  beforeAll(async () => {
    await connectToMongoDB();
    app = await getApp();

    // Clean up any existing test data
    await UserModel.deleteMany({
      username: {
        $in: [adminUser.username, entityUser.username, regularUser.username],
      },
    });

    // Create test users - hook will handle hashing
    await UserModel.create({
      username: adminUser.username,
      password: adminUser.password,
      role: adminUser.role as UserRole,
      points: 0,
      lastLogin: new Date(),
      treeGrowth: 0,
      sunwaterCoins: 0,
      allowedEnvironment: "development",
      createdAt: new Date(),
    });

    await UserModel.create({
      username: entityUser.username,
      password: entityUser.password,
      role: entityUser.role as UserRole,
      points: 0,
      lastLogin: new Date(),
      treeGrowth: 0,
      sunwaterCoins: 0,
      allowedEnvironment: "development",
      createdAt: new Date(),
    });

    await UserModel.create({
      username: regularUser.username,
      password: regularUser.password,
      role: regularUser.role as UserRole,
      points: 0,
      lastLogin: new Date(),
      treeGrowth: 0,
      sunwaterCoins: 0,
      allowedEnvironment: "development",
      createdAt: new Date(),
    });

    // Login to get token cookies
    const adminLoginRes = await request(app).post("/api/login").send({
      username: adminUser.username,
      password: adminUser.password,
    });
    adminCookie = getTokenCookie(adminLoginRes);

    const entityLoginRes = await request(app).post("/api/login").send({
      username: entityUser.username,
      password: entityUser.password,
    });
    entityCookie = getTokenCookie(entityLoginRes);

    const regularLoginRes = await request(app).post("/api/login").send({
      username: regularUser.username,
      password: regularUser.password,
    });
    regularCookie = getTokenCookie(regularLoginRes);

    // Create a test organization
    const org = await OrganizationModel.create({
      name: "Test Environmental Org",
      description: "Test organization for integration tests",
      website: "https://example.com",
    });
    testOrgId = org._id.toString();
  }, 20000);

  afterAll(async () => {
    // Clean up test data
    await UserModel.deleteMany({
      username: {
        $in: [adminUser.username, entityUser.username, regularUser.username],
      },
    });
    await ProjectModel.deleteMany({
      title: { $regex: /^Test Project/ },
    });
    await OrganizationModel.deleteOne({
      name: "Test Environmental Org",
    });
    await closeMongoConnection();
  });

  beforeEach(async () => {
    // Clean up projects before each test
    await ProjectModel.deleteMany({
      title: { $regex: /^Test Project/ },
    });
  });

  describe("POST /api/projects", () => {
    it("should require authentication", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({
          title: "Test Project",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      expect(res.status).toBe(401);
    });

    it("should allow entity user to create a project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Entity",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Test Project Entity");
      expect(res.body.approvalStatus).toBe("pending");
      expect(res.body.createdBy).toBeDefined();
      expect(res.body.currentFunding).toBe(0);
    });

    it("should allow admin user to create a project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Cookie", adminCookie)
        .send({
          title: "Test Project Admin",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Test Project Admin");
      expect(res.body.approvalStatus).toBe("pending");
    });
  });

  describe("GET /api/projects", () => {
    it("should only return approved projects", async () => {
      // Create projects with different approval statuses
      const entityUserDoc = await UserModel.findOne({
        username: entityUser.username,
      });
      const entityUserId = entityUserDoc!._id.toString();

      await ProjectModel.insertMany([
        {
          title: "Test Project Approved",
          description: "Approved project",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          currentFunding: 0,
          progress: 0,
          status: "active",
          approvalStatus: "approved",
          createdBy: entityUserId,
          allowedEnvironments: ["development"],
          proposal: TEST_PROPOSAL,
          createdAt: new Date(),
        },
        {
          title: "Test Project Pending",
          description: "Pending project",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          currentFunding: 0,
          progress: 0,
          status: "active",
          approvalStatus: "pending",
          createdBy: entityUserId,
          allowedEnvironments: ["development"],
          proposal: TEST_PROPOSAL,
          createdAt: new Date(),
        },
        {
          title: "Test Project Rejected",
          description: "Rejected project",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          currentFunding: 0,
          progress: 0,
          status: "active",
          approvalStatus: "rejected",
          createdBy: entityUserId,
          allowedEnvironments: ["development"],
          proposal: TEST_PROPOSAL,
          createdAt: new Date(),
        },
      ]);

      const res = await request(app).get("/api/projects").set("Cookie", entityCookie);
      expect(res.status).toBe(200);

      const projects = res.body as Array<{ title: string; approvalStatus: string }>;
      const testProjects = projects.filter((p) => p.title.startsWith("Test Project"));

      expect(testProjects.length).toBe(1);
      expect(testProjects[0].title).toBe("Test Project Approved");
      expect(testProjects[0].approvalStatus).toBe("approved");
    });
  });

  describe("GET /api/my-projects", () => {
    it("should require authentication", async () => {
      const res = await request(app).get("/api/my-projects");
      expect(res.status).toBe(401);
    });

    it("should return projects created by the authenticated entity user", async () => {
      // Create project as entity user
      await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project My Projects",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const res = await request(app).get("/api/my-projects").set("Cookie", entityCookie);

      expect(res.status).toBe(200);
      const projects = res.body as Array<{ title: string }>;
      const myTestProjects = projects.filter((p) => p.title.startsWith("Test Project"));

      expect(myTestProjects.length).toBeGreaterThanOrEqual(1);
      expect(myTestProjects[0].title).toContain("Test Project");
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("should require authentication", async () => {
      const res = await request(app).patch("/api/projects/123").send({ title: "Updated Title" });

      expect(res.status).toBe(401);
    });

    it("should allow project creator to update their project", async () => {
      // Create project as entity user
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Update",
          description: "Original description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Update the project
      const updateRes = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Updated Title",
          progress: 25,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.title).toBe("Test Project Updated Title");
      expect(updateRes.body.progress).toBe(25);
    });

    it("should not allow non-creator to update project", async () => {
      // Create project as entity user
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Forbidden",
          description: "Original description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Try to update with regular user
      const updateRes = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", regularCookie)
        .send({
          title: "Unauthorized Update",
        });

      expect(updateRes.status).toBe(403);
    });

    it("should allow admin to update any project", async () => {
      // Create project as entity user
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Admin Update",
          description: "Original description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Update with admin
      const updateRes = await request(app)
        .patch(`/api/projects/${project.id}`)
        .set("Cookie", adminCookie)
        .send({
          title: "Admin Updated New Title",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.title).toBe("Admin Updated New Title");
    });
  });

  describe("PATCH /api/projects/:id/approval", () => {
    it("should require admin role", async () => {
      // Create project
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Approval",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Try to approve as entity user
      const approveRes = await request(app)
        .patch(`/api/projects/${project.id}/approval`)
        .set("Cookie", entityCookie)
        .send({ status: "approved" });

      expect(approveRes.status).toBe(403);
    });

    it("should allow admin to approve a project", async () => {
      // Create project
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Admin Approval",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;
      expect(project.approvalStatus).toBe("pending");

      // Approve as admin
      const approveRes = await request(app)
        .patch(`/api/projects/${project.id}/approval`)
        .set("Cookie", adminCookie)
        .send({ status: "approved" });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.approvalStatus).toBe("approved");
    });

    it("should allow admin to reject a project", async () => {
      // Create project
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Admin Rejection",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Reject as admin
      const rejectRes = await request(app)
        .patch(`/api/projects/${project.id}/approval`)
        .set("Cookie", adminCookie)
        .send({ status: "rejected" });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.approvalStatus).toBe("rejected");
    });

    it("should reject invalid approval status", async () => {
      // Create project
      const createRes = await request(app)
        .post("/api/projects")
        .set("Cookie", entityCookie)
        .send({
          title: "Test Project Invalid Status",
          description: "Test description",
          organizationId: testOrgId,
          location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
          imageUrl: "https://example.com/image.jpg",
          targetFunding: 10000,
          status: "active",
          proposal: TEST_PROPOSAL,
        });

      const project = createRes.body;

      // Try invalid status
      const invalidRes = await request(app)
        .patch(`/api/projects/${project.id}/approval`)
        .set("Cookie", adminCookie)
        .send({ status: "invalid_status" });

      expect(invalidRes.status).toBe(400);
    });
  });
});
