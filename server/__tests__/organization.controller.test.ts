import { organizationController } from "../controllers/organization.controller";
import { storage } from "../mongo/storage";
import { Request, Response } from "express";

jest.mock("../mongo/storage", () => ({
  storage: {
    getOrganizations: jest.fn(),
    createOrganization: jest.fn(),
  },
}));

describe("OrganizationController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      body: {},
    };
    res = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("getOrganizations", () => {
    it("should return organizations", async () => {
      const mockOrgs = [{ id: "1", name: "Org 1" }];
      (storage.getOrganizations as jest.Mock).mockResolvedValue(mockOrgs);

      await organizationController.getOrganizations(req as Request, res as Response);

      expect(storage.getOrganizations).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockOrgs);
    });
  });
});
