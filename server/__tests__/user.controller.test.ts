import { userController } from "../controllers/user.controller";
import { storage } from "../mongo/storage";
import { Request, Response } from "express";

jest.mock("../mongo/storage", () => ({
  storage: {
    getUserContributions: jest.fn(),
    getUser: jest.fn(),
    updateSunwaterCoins: jest.fn(),
    updateTreeGrowth: jest.fn(),
    updateRoundUpSettings: jest.fn(),
  },
}));

describe("UserController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      user: { id: "user1" } as Request["user"],
      body: {},
    };
    res = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("getContributions", () => {
    it("should return user contributions", async () => {
      const mockContributions = [{ id: "c1", amount: 100 }];
      (storage.getUserContributions as jest.Mock).mockResolvedValue(mockContributions);

      await userController.getContributions(req as Request, res as Response);

      expect(storage.getUserContributions).toHaveBeenCalledWith("user1");
      expect(jsonMock).toHaveBeenCalledWith(mockContributions);
    });
  });
});
