import { projectController } from "../controllers/project.controller";
import { storage } from "../mongo/storage";
import { Response } from "express";
import { RequestWithEnvironment } from "../environment";
import { Environment } from "../../shared/schema-mongo";

jest.mock("../mongo/storage", () => ({
  storage: {
    getApprovedProjects: jest.fn(),
    getProject: jest.fn(),
    getProjectsByCreator: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    updateProjectApprovalStatus: jest.fn(),
    updateProjectProgress: jest.fn(),
    updateProjectFunding: jest.fn(),
    updateUserPoints: jest.fn(),
    recordUserContribution: jest.fn(),
  },
}));

describe("ProjectController", () => {
  let req: Partial<RequestWithEnvironment>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      environment: "development" as Environment,
      params: {},
      body: {},
    };
    res = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("getProjects", () => {
    it("should return approved projects", async () => {
      const mockProjects = [{ id: "1", title: "Project 1" }];
      (storage.getApprovedProjects as jest.Mock).mockResolvedValue(mockProjects);

      await projectController.getProjects(req as RequestWithEnvironment, res as Response);

      expect(storage.getApprovedProjects).toHaveBeenCalledWith("development");
      expect(jsonMock).toHaveBeenCalledWith(mockProjects);
    });

    it("should handle errors", async () => {
      (storage.getApprovedProjects as jest.Mock).mockRejectedValue(new Error("DB Error"));
      const next = jest.fn();

      await projectController.getProjects(req as RequestWithEnvironment, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("getProject", () => {
    it("should return a project if found", async () => {
      const validId = "507f1f77bcf86cd799439011";
      req.params = { id: validId };
      const mockProject = {
        id: validId,
        title: "Project 1",
        allowedEnvironments: ["development"],
      };
      (storage.getProject as jest.Mock).mockResolvedValue(mockProject);

      await projectController.getProject(req as RequestWithEnvironment, res as Response);

      expect(storage.getProject).toHaveBeenCalledWith(validId, "development");
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Project 1" }));
    });

    it("should return 404 if project not found", async () => {
      const validId = "507f1f77bcf86cd799439011";
      req.params = { id: validId };
      (storage.getProject as jest.Mock).mockResolvedValue(null);

      await projectController.getProject(req as RequestWithEnvironment, res as Response);

      expect(storage.getProject).toHaveBeenCalledWith(validId, "development");
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });
});
