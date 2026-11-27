import { seedMockData, clearMockData, getMockDataInfo } from "../mock-data";
import { storage } from "../mongo/storage";
import { ENVIRONMENTS, APPROVAL_STATUS } from "../../shared/schema-mongo";
import { connectToMongoDB, closeMongoConnection } from "../connect/mongodb";

describe("Mock Data Seeding", () => {
  beforeAll(async () => {
    // Connect once for all tests
    await connectToMongoDB();
  });

  afterAll(async () => {
    // Clean up and close connection after all tests
    try {
      await clearMockData();
    } catch (_error) {
      // Ignore errors if already cleaned
    }
    await closeMongoConnection();
  });

  beforeEach(async () => {
    // Clear mock data before each test
    await clearMockData();
  });

  describe("seedMockData", () => {
    it("should seed mock data in development environment", async () => {
      await seedMockData(ENVIRONMENTS.development);

      // Verify projects were created
      const projects = await storage.getProjects();
      const mockProjects = projects.filter((p) =>
        p.allowedEnvironments?.includes(ENVIRONMENTS.development),
      );

      expect(mockProjects.length).toBeGreaterThanOrEqual(3);

      // Check for specific project titles
      const projectTitles = mockProjects.map((p) => p.title);
      expect(projectTitles).toContain("Solar Energy Farm - California");
      expect(projectTitles).toContain("Centro Comunitario de Energía Solar - Oaxaca");
      expect(projectTitles).toContain("Reforestação da Amazônia - Acre");
    });

    it("should seed mock data in sandbox environment", async () => {
      await seedMockData(ENVIRONMENTS.sandbox);

      // Verify projects were created
      const projects = await storage.getProjects();
      const mockProjects = projects.filter((p) =>
        p.allowedEnvironments?.includes(ENVIRONMENTS.sandbox),
      );

      expect(mockProjects.length).toBeGreaterThanOrEqual(3);
    });

    it("should not seed mock data in production environment", async () => {
      const mockProjectTitles = getMockDataInfo().projectTitles;
      const projectsBefore = await storage.getProjects();
      const mockProjectsBefore = projectsBefore.filter((p) => mockProjectTitles.includes(p.title));
      const countBefore = mockProjectsBefore.length;

      await seedMockData(ENVIRONMENTS.production);

      const projectsAfter = await storage.getProjects();
      const mockProjectsAfter = projectsAfter.filter((p) => mockProjectTitles.includes(p.title));
      const countAfter = mockProjectsAfter.length;

      // Count of mock projects should not increase in production
      expect(countAfter).toBe(countBefore);
    });

    it("should create mock entity user", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const mockUser = await storage.getUserByUsername("mock_entity");
      expect(mockUser).toBeDefined();
      expect(mockUser?.role).toBe("entity");
      expect(mockUser?.allowedEnvironment).toBe(ENVIRONMENTS.development);
    });

    it("should create mock organizations", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const orgs = await storage.getOrganizations();
      const orgNames = orgs.map((o) => o.name);

      expect(orgNames).toContain("Green America Foundation");
      expect(orgNames).toContain("Energía Sustentable México");
      expect(orgNames).toContain("Amazonas Verde");
    });

    it("should create projects with correct data structure", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const projects = await storage.getProjects();
      const californiaProject = projects.find((p) => p.title.includes("California"));

      expect(californiaProject).toBeDefined();
      expect(californiaProject?.location.lat).toBeCloseTo(36.7783, 3);
      expect(californiaProject?.location.lng).toBeCloseTo(-119.4179, 3);
      expect(californiaProject?.location.address).toContain("California");
      expect(californiaProject?.targetFunding).toBe(2500000);
      expect(californiaProject?.approvalStatus).toBe(APPROVAL_STATUS.approved);
      expect(californiaProject?.allowedEnvironments).toContain(ENVIRONMENTS.development);
    });

    it("should create projects with initial funding and progress", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const projects = await storage.getProjects();
      const oaxacaProject = projects.find((p) => p.title.includes("Oaxaca"));

      expect(oaxacaProject).toBeDefined();
      expect(oaxacaProject?.currentFunding).toBeGreaterThan(0);
      expect(oaxacaProject?.progress).toBeGreaterThan(0);
      expect(oaxacaProject?.progress).toBeLessThanOrEqual(100);
    });

    it("should create open-ended donation project without targetFunding", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const projects = await storage.getProjects();
      const ongoingProject = projects.find((p) => p.title.includes("Community Solar Fund"));

      expect(ongoingProject).toBeDefined();
      expect(ongoingProject?.targetFunding).toBeUndefined();
      expect(ongoingProject?.currentFunding).toBe(15000);
      expect(ongoingProject?.approvalStatus).toBe(APPROVAL_STATUS.approved);
    });

    it("should not duplicate data when seeding multiple times", async () => {
      const mockProjectTitles = getMockDataInfo().projectTitles;
      await seedMockData(ENVIRONMENTS.development);
      const projectsAfterFirst = await storage.getProjects();
      const mockProjectsAfterFirst = projectsAfterFirst.filter((p) =>
        mockProjectTitles.includes(p.title),
      );
      const countAfterFirst = mockProjectsAfterFirst.length;

      // Seed again
      await seedMockData(ENVIRONMENTS.development);
      const projectsAfterSecond = await storage.getProjects();
      const mockProjectsAfterSecond = projectsAfterSecond.filter((p) =>
        mockProjectTitles.includes(p.title),
      );
      const countAfterSecond = mockProjectsAfterSecond.length;

      // Count of mock projects should remain the same
      expect(countAfterSecond).toBe(countAfterFirst);
      expect(countAfterFirst).toBe(5);
    });

    it("should assign projects to organizations", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const projects = await storage.getProjects();

      // Filter to only mock projects
      const mockProjects = projects.filter((p) =>
        p.allowedEnvironments?.includes(ENVIRONMENTS.development),
      );

      expect(mockProjects.length).toBeGreaterThanOrEqual(3);

      // Each mock project should have an organizationId set
      for (const project of mockProjects) {
        expect(project.organizationId).toBeDefined();
        expect(typeof project.organizationId).toBe("string");
        expect(project.organizationId.length).toBeGreaterThan(0);
      }
    });

    it("should create projects in different locations", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const projects = await storage.getProjects();
      const mockProjects = projects.filter((p) =>
        p.allowedEnvironments?.includes(ENVIRONMENTS.development),
      );

      // Check for US project
      const usProject = mockProjects.find((p) => p.location.address.includes("USA"));
      expect(usProject).toBeDefined();

      // Check for Mexico project
      const mexicoProject = mockProjects.find((p) => p.location.address.includes("México"));
      expect(mexicoProject).toBeDefined();

      // Check for Brazil project
      const brazilProject = mockProjects.find((p) => p.location.address.includes("Brasil"));
      expect(brazilProject).toBeDefined();
    });
  });

  describe("clearMockData", () => {
    it("should remove all mock data", async () => {
      // Seed data first
      await seedMockData(ENVIRONMENTS.development);

      const projectsBefore = await storage.getProjects();
      expect(projectsBefore.length).toBeGreaterThan(0);

      // Clear mock data
      await clearMockData();

      // Verify projects are removed
      const projectsAfter = await storage.getProjects();
      const mockProjectsAfter = projectsAfter.filter(
        (p) =>
          p.title.includes("Solar Energy Farm") ||
          p.title.includes("Centro Comunitario") ||
          p.title.includes("Reforestação") ||
          p.title.includes("Community Solar Fund") ||
          p.title.includes("Donate to BerryBank Green Fund"),
      );

      expect(mockProjectsAfter.length).toBe(0);

      // Verify mock user is removed
      const mockUser = await storage.getUserByUsername("mock_entity");
      expect(mockUser).toBeUndefined();
    });
  });

  describe("getMockDataInfo", () => {
    it("should return correct information about mock data", () => {
      const info = getMockDataInfo();

      expect(info.organizations).toBe(4);
      expect(info.projects).toBe(5);
      expect(info.projectTitles).toHaveLength(5);
      expect(info.totalTargetFunding).toBeGreaterThan(0);
    });

    it("should include all project titles", () => {
      const info = getMockDataInfo();

      expect(info.projectTitles).toContain("Solar Energy Farm - California");
      expect(info.projectTitles).toContain("Centro Comunitario de Energía Solar - Oaxaca");
      expect(info.projectTitles).toContain("Reforestação da Amazônia - Acre");
      expect(info.projectTitles).toContain("Community Solar Fund - Ongoing");
      expect(info.projectTitles).toContain("Donate to BerryBank Green Fund");
    });

    it("should calculate total funding correctly", () => {
      const info = getMockDataInfo();

      // 2,500,000 + 750,000 + 1,200,000 = 4,450,000
      expect(info.totalTargetFunding).toBe(4450000);
    });
  });

  describe("Environment filtering", () => {
    it("should only return projects for current environment", async () => {
      await seedMockData(ENVIRONMENTS.development);

      const devProjects = await storage.getApprovedProjects(ENVIRONMENTS.development);
      expect(devProjects.length).toBeGreaterThan(0);

      // In a fresh database, production should have no mock projects
      const prodProjects = await storage.getApprovedProjects(ENVIRONMENTS.production);
      const mockProdProjects = prodProjects.filter((p) =>
        p.allowedEnvironments?.includes(ENVIRONMENTS.development),
      );
      expect(mockProdProjects.length).toBe(0);
    });
  });
});
