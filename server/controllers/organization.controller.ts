import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { storage } from "../mongo/storage";
import { type InsertOrganization } from "@shared/schema-mongo";

export class OrganizationController {
  getOrganizations = asyncHandler(async (_req: Request, res: Response) => {
    const orgs = await storage.getOrganizations();
    res.json(orgs);
  });

  createOrganization = asyncHandler(async (req: Request, res: Response) => {
    const orgData = req.body as InsertOrganization;
    const org = await storage.createOrganization(orgData);
    res.json(org);
  });
}

export const organizationController = new OrganizationController();
