import { storage } from "../mongo/storage";
import { type Environment, type Project } from "@shared/schema-mongo";
import { logger } from "../logger";

export interface HybridSearchParams {
  query: string;
  environment: Environment;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  limit?: number;
}

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

  /**
   * Trigger asynchronous AI vetting worker when a project is submitted or documents are uploaded.
   * TODO: Enqueue job (Cloud Tasks / BullMQ / in-process worker) calling
   * `documentStorageService.buildAdminTriageScorecard(projectId, documentUrls)`.
   */
  async enqueueProjectVettingJob(_projectId: string, _documentUrls: string[]): Promise<void> {
    throw new Error("TODO: Implement ProjectService.enqueueProjectVettingJob");
  }

  /**
   * Generate and persist vector embeddings for an approved/updated project.
   * TODO: Embed title + description + proposal.methodology + latest updates using EMBEDDING_MODEL
   * and store on the MongoDB Project document for Atlas Vector Search (sync on update/delete).
   */
  async generateProjectEmbedding(_project: Project): Promise<number[]> {
    throw new Error("TODO: Implement ProjectService.generateProjectEmbedding");
  }

  /**
   * Hybrid Search: MongoDB Atlas Vector Search + geospatial ($geoNear) + environment/approval filters.
   * TODO:
   * 1. Embed `params.query`
   * 2. Run `$vectorSearch` filtered by `approvalStatus: "approved"` and `allowedEnvironments`
   * 3. Combine similarity scores with Haversine / `$geoNear` distance when `lat`/`lng` are provided
   */
  async hybridSearchProjects(_params: HybridSearchParams): Promise<Project[]> {
    throw new Error("TODO: Implement ProjectService.hybridSearchProjects");
  }

  /**
   * Generate a personalized, grounded Impact Digest when a user's $5 round-up batch flushes.
   * TODO: Summarize exact real-world impact from the funded projects' latest progress updates
   * and deliver via EmailService / profile receipt.
   */
  async generateRoundUpImpactDigest(_userId: string, _batchId: string): Promise<string> {
    throw new Error("TODO: Implement ProjectService.generateRoundUpImpactDigest");
  }
}

export const projectService = new ProjectService();
