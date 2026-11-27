import { commonController } from "../controllers/common.controller";
import { Request, Response } from "express";
import { detectServerLocale, extractUserMetadata } from "../locale-detection";

jest.mock("../locale-detection", () => ({
  detectServerLocale: jest.fn(),
  extractUserMetadata: jest.fn(),
}));

jest.mock("../logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe("CommonController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: {},
      ip: "127.0.0.1",
      connection: { remoteAddress: "127.0.0.1" } as Request["connection"],
      body: {},
    };
    res = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("getLocale", () => {
    it("should return detected locale", async () => {
      (extractUserMetadata as jest.Mock).mockReturnValue({ browserLanguage: "en-US" });
      (detectServerLocale as jest.Mock).mockResolvedValue("en-US");

      await commonController.getLocale(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: "en-US",
          detectedFrom: "server",
        }),
      );
    });

    it("should fallback on error", async () => {
      (detectServerLocale as jest.Mock).mockRejectedValue(new Error("Locale error"));

      await commonController.getLocale(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: "en-US",
          detectedFrom: "fallback",
        }),
      );
    });
  });
});
