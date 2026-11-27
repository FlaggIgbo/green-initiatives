import { logger } from "./logger";
import { storage } from "./mongo/storage";
import {
  type InsertOrganization,
  type InsertProject,
  type Environment,
  ENVIRONMENTS,
  USER_ROLES,
  APPROVAL_STATUS,
  type Organization,
  type ProjectImpactMetrics,
  type Proposal,
} from "@shared/schema-mongo";
import { ProjectModel, OrganizationModel, UserModel } from "./models";
import { ADMIN_USERNAME, SANDBOX_ADMIN_PASSWORD, DEV_ADMIN_PASSWORD } from "./constants";

/**
 * Mock Organizations - Organizations that will sponsor the projects
 */
const MOCK_ORGANIZATIONS: InsertOrganization[] = [
  {
    name: "Green America Foundation",
    description:
      "A non-profit organization dedicated to renewable energy and sustainable infrastructure in the United States",
    website: "https://greenamericafoundation.org",
  },
  {
    name: "Energía Sustentable México",
    description:
      "Organización mexicana enfocada en proyectos de energía solar y desarrollo comunitario sostenible",
    website: "https://energiasustentable.mx",
  },
  {
    name: "Amazonas Verde",
    description:
      "Iniciativa brasileña para la reforestación y conservación de la biodiversidad amazónica",
    website: "https://amazonasverde.br",
  },
  {
    name: "BerryBank",
    description:
      "BerryBank's green initiatives fund. Your donations support environmental projects and sustainable banking practices.",
    website: "https://www.berrybank.app",
  },
];

/**
 * Mock Projects - Three sustainable projects from different regions
 */
interface MockProjectData {
  title: string;
  description: string;
  organizationIndex: number; // Index in MOCK_ORGANIZATIONS array
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl: string;
  targetFunding?: number; // Optional for open-ended donation projects
  status: string;
  initialProgress?: number;
  initialFunding: number;
  impactMetrics?: ProjectImpactMetrics;
  proposal: Proposal;
}

const MOCK_PROJECTS: MockProjectData[] = [
  {
    title: "Solar Energy Farm - California",
    description:
      "A 50-acre solar farm project in California's Central Valley designed to provide clean, renewable energy to over 5,000 homes. This initiative includes battery storage systems to ensure consistent power supply and will create 150 local jobs during construction and 25 permanent positions for maintenance and operations. The project aligns with California's ambitious renewable energy goals and will offset approximately 12,000 tons of CO2 emissions annually.",
    organizationIndex: 0,
    location: {
      lat: 36.7783,
      lng: -119.4179,
      address: "Fresno County, California, USA",
    },
    imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80",
    targetFunding: 2500000,
    status: "active",
    initialProgress: 35,
    initialFunding: 875000,
    impactMetrics: {
      type: "carbon",
      unit: "tons CO2",
      targetAmount: 12000,
      currentAmount: 4200,
      perDollar: 0.0048,
    },
    proposal: {
      objectives:
        "Installation of a 50-acre solar farm with battery storage to provide clean energy and create local jobs.",
      methodology:
        "Phased construction including site preparation, panel installation, and grid connection.",
      timeline: [
        {
          phase: "Site Preparation",
          duration: "3 months",
          deliverables: "Cleared site and foundation work",
        },
      ],
      fundingBreakdown: [
        {
          description: "Solar Panels",
          category: "Equipment",
          amount: 1500000,
        },
      ],
      measurableImpact: {
        metric: "CO2 Offset (tons/year)",
        targetValue: 12000,
        trackingMethod: "Annual emissions monitoring via certified carbon auditors",
      },
      supportingDocuments: [],
    },
  },
  {
    title: "Centro Comunitario de Energía Solar - Oaxaca",
    description:
      "Proyecto de instalación de paneles solares en escuelas y centros comunitarios rurales en Oaxaca, México. Esta iniciativa proporcionará electricidad limpia y confiable a 15 comunidades indígenas, beneficiando a más de 3,000 familias. El proyecto incluye capacitación técnica para residentes locales en instalación y mantenimiento de sistemas solares, creando oportunidades económicas sostenibles. Se reducirán aproximadamente 800 toneladas de emisiones de CO2 anualmente.",
    organizationIndex: 1,
    location: {
      lat: 17.0732,
      lng: -96.7266,
      address: "Oaxaca de Juárez, Oaxaca, México",
    },
    imageUrl: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=800&q=80",
    targetFunding: 750000,
    status: "active",
    initialProgress: 60,
    initialFunding: 450000,
    impactMetrics: {
      type: "water",
      unit: "liters",
      targetAmount: 500000,
      currentAmount: 300000,
      perDollar: 0.67,
    },
    proposal: {
      objectives:
        "Installation of solar panels in schools and community centers with technical training for locals.",
      methodology: "Community-led installation and training program for local maintenance.",
      timeline: [
        {
          phase: "Community Training",
          duration: "2 months",
          deliverables: "20 trained local technicians",
        },
      ],
      fundingBreakdown: [
        {
          description: "Training Materials",
          category: "Education",
          amount: 50000,
        },
      ],
      measurableImpact: {
        metric: "Families Benefited",
        targetValue: 3000,
        trackingMethod: "Community surveys and household registration tracking",
      },
      supportingDocuments: [],
    },
  },
  {
    title: "Reforestação da Amazônia - Acre",
    description:
      "Programa extensivo de reforestação no estado do Acre, Brasil, focado na restauração de 10,000 hectares de floresta amazônica degradada. O projeto utiliza espécies nativas e técnicas agroflorestais para promover a biodiversidade e apoiar comunidades locais através do empleo sustentável. Mais de 500 famílias participarão ativamente no plantio e manutenção das árvores, com treinamento em práticas ambientais sustentáveis. Este projeto tem potencial de sequestrar mais de 50,000 toneladas de CO2 nos próximos 10 anos.",
    organizationIndex: 2,
    location: {
      lat: -9.0238,
      lng: -70.812,
      address: "Rio Branco, Acre, Brasil",
    },
    imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80",
    targetFunding: 1200000,
    status: "active",
    initialProgress: 42,
    initialFunding: 504000,
    impactMetrics: {
      type: "trees",
      unit: "trees",
      targetAmount: 100000,
      currentAmount: 42000,
      perDollar: 0.083,
    },
    proposal: {
      objectives: "Extensive reforestation using native species and agroforestry techniques.",
      methodology: "Seedling production and strategic planting in degraded areas.",
      timeline: [
        {
          phase: "Nursery Setup",
          duration: "4 months",
          deliverables: "100,000 native seedlings",
        },
      ],
      fundingBreakdown: [
        {
          description: "Seedlings",
          category: "Operations",
          amount: 300000,
        },
      ],
      measurableImpact: {
        metric: "Hectares Restored",
        targetValue: 10000,
        trackingMethod: "Satellite imagery analysis and ground verification surveys",
      },
      supportingDocuments: [],
    },
  },
  {
    title: "Community Solar Fund - Ongoing",
    description:
      "An ongoing community fund that accepts donations year-round to support local solar installations in underserved neighborhoods. Unlike campaign-style projects, this fund continuously deploys resources as they come in, enabling incremental progress on multiple small-scale installations. Donations help purchase panels, inverters, and installation services for schools, community centers, and low-income housing.",
    organizationIndex: 0,
    location: {
      lat: 42.3601,
      lng: -71.0589,
      address: "Boston, Massachusetts, USA",
    },
    imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80",
    status: "active",
    initialFunding: 15000,
    impactMetrics: {
      type: "carbon",
      unit: "tons CO2",
      targetAmount: 500,
      currentAmount: 75,
      perDollar: 0.005,
    },
    proposal: {
      objectives:
        "Provide ongoing support for community solar installations through continuous fundraising.",
      methodology:
        "Deploy funds as they are received to qualified community solar projects on a rolling basis.",
      timeline: [
        {
          phase: "Ongoing",
          duration: "Continuous",
          deliverables: "Quarterly impact reports",
        },
      ],
      fundingBreakdown: [
        {
          description: "Solar Equipment",
          category: "Equipment",
          amount: 50000,
        },
      ],
      measurableImpact: {
        metric: "CO2 Offset (tons/year)",
        targetValue: 500,
        trackingMethod: "Installation records and utility data",
      },
      supportingDocuments: [],
    },
  },
  {
    title: "Donate to BerryBank Green Fund",
    description:
      "Support BerryBank's ongoing commitment to environmental sustainability. Your donations fund green initiatives and community environmental projects. This is an open-ended fund—donations are deployed continuously to maximize impact.",
    organizationIndex: 3,
    location: {
      lat: 40.7128,
      lng: -74.006,
      address: "New York City, NY, USA",
    },
    imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80",
    status: "active",
    initialFunding: 0,
    proposal: {
      objectives: "Ongoing fund for BerryBank environmental initiatives.",
      methodology: "Deploy donations to green projects and community environmental initiatives.",
      timeline: [
        {
          phase: "Ongoing",
          duration: "Continuous",
          deliverables: "Quarterly impact reports",
        },
      ],
      fundingBreakdown: [
        {
          description: "Environmental projects",
          category: "Green Initiatives",
          amount: 50000,
        },
      ],
      measurableImpact: {
        metric: "Environmental projects funded",
        targetValue: 10,
        trackingMethod: "Quarterly impact reports",
      },
      supportingDocuments: [],
    },
  },
];

/**
 * Seed mock data into the database
 * Only runs in development and sandbox environments
 * IMPORTANT: Mock data should NEVER be seeded to cloud databases
 */
export async function seedMockData(environment: Environment): Promise<void> {
  // Only seed in development and sandbox
  if (environment === ENVIRONMENTS.production) {
    logger.info("Mock data seeding skipped: production environment");
    return;
  }

  // Additional safeguard: Never seed to cloud databases (MongoDB Atlas)
  // To allow seeding to a cloud sandbox, the user must set ALLOW_MOCK_DATA_ON_CLOUD=true
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const isCloudDatabase =
    mongoUri.includes("mongodb+srv") ||
    mongoUri.includes(".mongodb.net") ||
    (!mongoUri.includes("localhost") && !mongoUri.includes("127.0.0.1"));

  const isExplicitlyAllowed = process.env.ALLOW_MOCK_DATA_ON_CLOUD === "true";

  if (isCloudDatabase && !isExplicitlyAllowed) {
    logger.info("Mock data seeding skipped: connected to cloud database");
    logger.info(
      "To enable seeding on cloud databases (e.g. sandbox Atlas), set ALLOW_MOCK_DATA_ON_CLOUD=true",
    );
    return;
  }

  // Double check environment - NEVER seed in production even if ALLOW_MOCK_DATA_ON_CLOUD is true
  // Note: environment === production is already checked above, but NODE_ENV may differ
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod") {
    logger.warn("🛑 CRITICAL: Mock data seeding blocked for PRODUCTION environment");
    return;
  }

  // Triple check: Check for "prod" in URI or DB name as a final safety measure
  const dbName = process.env.DB_NAME || "greenInitiatives";
  if (mongoUri.toLowerCase().includes("prod") || dbName.toLowerCase().includes("prod")) {
    logger.warn("🛑 CRITICAL: Mock data seeding blocked because URI or DB name contains 'prod'");
    return;
  }

  // Check if mock data already exists
  // We'll proceed with upserting each project to ensure they are correct
  logger.info(`🌱 Syncing mock data for ${environment} environment...`);

  try {
    // Create or update demo admin user
    const isAdminSandbox = environment === ENVIRONMENTS.sandbox;
    const adminPassword = isAdminSandbox ? SANDBOX_ADMIN_PASSWORD : DEV_ADMIN_PASSWORD;

    // Always ensure admin exists with correct credentials and role
    await UserModel.deleteOne({ username: ADMIN_USERNAME });
    await storage.createUser(
      {
        username: ADMIN_USERNAME,
        password: adminPassword,
        role: USER_ROLES.admin,
      },
      environment,
    );
    logger.info(`✅ Initialized demo admin user (${environment} mode)`);

    // Create a mock user to be the creator of projects (entity role)
    // NOTE: This user should ONLY exist in local development databases
    let mockEntityUser;
    const existingUser = await storage.getUserByUsername("mock_entity");

    if (!existingUser) {
      mockEntityUser = await storage.createUser(
        {
          username: "mock_entity",
          password: "mock_password_123", // In a real scenario, this should be hashed
          role: USER_ROLES.entity,
        },
        environment,
      );
      logger.info("✅ Created mock entity user");
    } else {
      mockEntityUser = existingUser;
      logger.info("ℹ️  Using existing mock entity user");
    }

    // Create a mock regular user
    const existingRegularUser = await storage.getUserByUsername("mock_user");
    if (!existingRegularUser) {
      await storage.createUser(
        {
          username: "mock_user",
          password: "mock_password_123",
          role: USER_ROLES.user,
        },
        environment,
      );
      logger.info("✅ Created mock regular user");
    }

    // Create organizations
    const createdOrgs = [];
    for (const org of MOCK_ORGANIZATIONS) {
      // Check if organization already exists
      const existingOrg = await OrganizationModel.findOne({ name: org.name });

      if (existingOrg) {
        // Transform to expected Organization type
        const orgObj = existingOrg.toObject();
        const org = { ...orgObj, id: String(orgObj._id) } as Organization;
        createdOrgs.push(org);
        logger.info(`ℹ️  Using existing organization: ${org.name}`);
      } else {
        const created = await storage.createOrganization(org);
        createdOrgs.push(created);
        logger.info(`✅ Created organization: ${org.name}`);
      }
    }

    // Create projects
    for (const projectData of MOCK_PROJECTS) {
      const organization = createdOrgs[projectData.organizationIndex];

      const project: InsertProject = {
        title: projectData.title,
        description: projectData.description,
        organizationId: organization.id,
        location: projectData.location,
        imageUrl: projectData.imageUrl,
        ...(projectData.targetFunding != null && { targetFunding: projectData.targetFunding }),
        status: projectData.status,
        allowedEnvironments: [ENVIRONMENTS.sandbox, ENVIRONMENTS.development],
        proposal: projectData.proposal,
        ...(projectData.impactMetrics && { impactMetrics: projectData.impactMetrics }),
      };

      // Create the project with the mock entity as creator
      const projectDoc = {
        ...project,
        currentFunding: projectData.initialFunding,
        progress: projectData.initialProgress ?? 0,
        approvalStatus: APPROVAL_STATUS.approved, // Pre-approve mock projects
        createdBy: mockEntityUser.id,
        createdAt: new Date(),
        allowedEnvironments: [ENVIRONMENTS.sandbox, ENVIRONMENTS.development],
      };

      // Ensure allowedEnvironments is present and includes both for mock data
      await ProjectModel.updateOne(
        { title: project.title },
        {
          $set: projectDoc,
        },
        { upsert: true },
      );

      logger.info(`✅ Created/Updated project: ${projectData.title}`);
    }

    logger.info("🎉 Mock data seeding completed successfully!");
  } catch (error) {
    logger.error("❌ Error seeding mock data:", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clear mock data from the database
 * Useful for testing and resetting the database
 */
export async function clearMockData(): Promise<void> {
  logger.info("🧹 Clearing mock data...");

  // Delete mock projects
  await ProjectModel.deleteMany({
    title: { $in: MOCK_PROJECTS.map((p) => p.title) },
  });

  // Delete mock organizations
  await OrganizationModel.deleteMany({
    name: { $in: MOCK_ORGANIZATIONS.map((o) => o.name) },
  });

  // Delete mock entity user
  await UserModel.deleteMany({
    username: "mock_entity",
  });

  logger.info("✅ Mock data cleared successfully!");
}

/**
 * Get information about mock data
 */
export function getMockDataInfo() {
  return {
    organizations: MOCK_ORGANIZATIONS.length,
    projects: MOCK_PROJECTS.length,
    projectTitles: MOCK_PROJECTS.map((p) => p.title),
    totalTargetFunding: MOCK_PROJECTS.reduce((sum, p) => sum + (p.targetFunding ?? 0), 0),
  };
}
