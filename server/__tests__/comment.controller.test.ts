import { commentController } from "../controllers/comment.controller";
import { storage } from "../mongo/storage";
import { Request, Response } from "express";

jest.mock("../mongo/storage", () => ({
  storage: {
    getProjectComments: jest.fn(),
    getProjectCommentCount: jest.fn(),
    createComment: jest.fn(),
    getComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    toggleCommentLike: jest.fn(),
    flagComment: jest.fn(),
    getFlaggedComments: jest.fn(),
    moderateComment: jest.fn(),
  },
}));

jest.mock("../websocket", () => ({
  broadcastNewComment: jest.fn(),
  broadcastCommentUpdate: jest.fn(),
}));

jest.mock("../logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("CommentController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      params: {},
      body: {},
      user: { id: "user1", username: "testuser", role: "user" } as Request["user"],
    };
    res = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("getProjectComments", () => {
    it("should return comments and count", async () => {
      const mockComments = [{ id: "c1", content: "hello" }];
      req.params = { id: "p1" };
      (storage.getProjectComments as jest.Mock).mockResolvedValue(mockComments);
      (storage.getProjectCommentCount as jest.Mock).mockResolvedValue(1);

      await commentController.getProjectComments(req as Request, res as Response);

      expect(storage.getProjectComments).toHaveBeenCalledWith("p1");
      expect(jsonMock).toHaveBeenCalledWith({ comments: mockComments, count: 1 });
    });

    it("should handle errors", async () => {
      req.params = { id: "p1" };
      (storage.getProjectComments as jest.Mock).mockRejectedValue(new Error("DB Error"));
      const next = jest.fn();

      await commentController.getProjectComments(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("createComment", () => {
    it("should create a comment successfully", async () => {
      req.params = { id: "p1" };
      req.body = { content: "new comment" };
      const mockComment = { id: "c1", content: "new comment", projectId: "p1" };
      (storage.createComment as jest.Mock).mockResolvedValue(mockComment);

      await commentController.createComment(req as Request, res as Response);

      expect(storage.createComment).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockComment);
    });
  });
});
