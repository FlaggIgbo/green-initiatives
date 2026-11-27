import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { storage } from "../mongo/storage";
import { projectService } from "../services/project.service";
import { type InsertProject, type UpdateProject } from "@shared/schema-mongo";
import { RequestWithEnvironment } from "../environment";
import { documentStorageService } from "../services/document-storage";

export class ProjectController {
  getProjects = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const environment = req.environment;
    const projects = await storage.getApprovedProjects(environment);
    res.json(projects);
  });

  getProject = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    const environment = req.environment;
    const project = await storage.getProject(String(req.params.id), environment);

    if (!project) {
      res.status(404).json({ error: "Project not found or not available in this environment" });
      return;
    }

    res.json(project);
  });

  getMyProjects = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const environment = req.environment;

    let projects;
    if (req.user.role === "admin") {
      projects = await storage.getAllProjects(environment);
    } else {
      projects = await storage.getProjectsByCreator(req.user.id, environment);
    }
    res.json(projects);
  });

  createProject = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectData: InsertProject = {
      ...req.body,
      createdBy: req.user.id,
    };

    const currentEnv = req.environment;
    const project = await storage.createProject(projectData, currentEnv);
    res.json(project);
  });

  updateProject = asyncHandler(async (req: RequestWithEnvironment, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const environment = req.environment;
    const projectId = String(req.params.id);
    const project = await storage.getProject(projectId, environment);
    if (!project) {
      res.status(404).json({ error: "Project not found or not available in this environment" });
      return;
    }

    // Only allow creator or admin to update
    if (project.createdBy !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: You can only update your own projects" });
      return;
    }

    const updatedProject = await storage.updateProject(projectId, req.body as UpdateProject);
    res.json(updatedProject);
  });

  updateApprovalStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const { status } = req.body;

    const project = await storage.updateProjectApprovalStatus(String(req.params.id), status);
    res.json(project);
  });

  updateProgress = asyncHandler(async (req: Request, res: Response) => {
    const { progress } = req.body;
    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      res.status(400).json({ error: "Invalid progress value" });
      return;
    }

    const project = await storage.updateProjectProgress(String(req.params.id), progress);
    res.json(project);
  });

  fundProject = asyncHandler(async (req: Request, res: Response) => {
    const { amount } = req.body;
    const project = await projectService.processFunding(
      String(req.params.id),
      amount,
      req.user?.id,
    );
    res.json(project);
  });

  getUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      res.status(400).json({ error: "fileName and contentType are required" });
      return;
    }

    const urls = await documentStorageService.getPreSignedUploadUrl(fileName, contentType);
    res.json(urls);
  });

  verifyImpactTracking = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { method, proofUrl } = req.body;
    if (!method) {
      res.status(400).json({ error: "Impact tracking method is required" });
      return;
    }

    const result = await projectService.verifyImpact(String(req.params.id), method, proofUrl);
    res.json({
      ...result,
      method,
    });
  });
}

export const projectController = new ProjectController();
