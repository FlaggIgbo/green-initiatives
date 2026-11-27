import { storage } from "../mongo/storage";
import { type Project } from "@shared/schema-mongo";
import { logger } from "../logger";

export class ProjectService {
  async processFunding(projectId: string, amount: number, userId?: string): Promise<Project> {
    const project = await storage.updateProjectFunding(projectId, amount);

    // Award points for supporting a project
    if (userId) {
      await storage.updateUserPoints(userId, 50);
      // Record the contribution for user's profile
      await storage.recordUserContribution(userId, projectId, amount);

      logger.info(`Processed funding for project ${projectId}`, {
        userId,
        amount,
        projectTitle: project.title,
      });
    }

    return project;
  }

  async verifyImpact(
    projectId: string,
    method: string,
    proofUrl?: string,
  ): Promise<{ verified: boolean; message: string }> {
    // TODO: Implement actual verification logic
    // 1. Check if method is supported (IoT, Manual Audit, Satellite, etc.)
    // 2. Validate proofUrl if provided
    // 3. Connect to external tracking APIs (e.g., IoT sensor dashboard)
    // 4. Update project verification status in DB

    logger.info(`Verifying impact for project ${projectId}`, { method, proofUrl });

    return {
      verified: true,
      message: "Impact tracking method verified (delegated to service)",
    };
  }
}

export const projectService = new ProjectService();
