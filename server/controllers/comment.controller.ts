import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { storage } from "../mongo/storage";
import { type InsertComment, type UpdateComment, type FlagComment } from "@shared/schema-mongo";
import { broadcastNewComment, broadcastCommentUpdate } from "../websocket";
import { logger } from "../logger";

export class CommentController {
  getProjectComments = asyncHandler(async (req: Request, res: Response) => {
    const projectId = String(req.params.id);
    const comments = await storage.getProjectComments(projectId);
    const count = await storage.getProjectCommentCount(projectId);
    res.json({ comments, count });
  });

  createComment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const commentData: InsertComment = {
      ...req.body,
      projectId: String(req.params.id),
    };

    const comment = await storage.createComment(commentData, req.user.id, req.user.username);

    // Broadcast via WebSocket for real-time updates
    broadcastNewComment(comment);

    res.status(201).json(comment);
  });

  updateComment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const commentId = String(req.params.id);
    const comment = await storage.getComment(commentId);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    // Only owner or admin can edit
    if (comment.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "You can only edit your own comments" });
      return;
    }

    const updated = await storage.updateComment(commentId, req.body as UpdateComment);
    res.json(updated);
  });

  deleteComment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const commentId = String(req.params.id);
    const comment = await storage.getComment(commentId);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    // Only owner or admin can delete
    if (comment.userId !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "You can only delete your own comments" });
      return;
    }

    await storage.deleteComment(commentId);
    res.json({ success: true });
  });

  toggleLike = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const comment = await storage.toggleCommentLike(String(req.params.id), req.user.id);

    // Broadcast like update
    broadcastCommentUpdate("comment_like", comment.projectId, comment.id, {
      likes: comment.likes,
      likedBy: comment.likedBy,
    });

    res.json(comment);
  });

  flagComment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const flagData = req.body as FlagComment;

    try {
      const comment = await storage.flagComment(
        String(req.params.id),
        req.user.id,
        flagData.reason,
        flagData.details,
      );
      res.json({ success: true, comment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already flagged")) {
        res.status(400).json({ error: message });
        return;
      }
      throw error; // Let asyncHandler handle it
    }
  });

  getFlaggedComments = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const comments = await storage.getFlaggedComments();
    logger.info(`Admin fetching flagged comments. Total found: ${comments.length}`);
    res.json(comments);
  });

  moderateComment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const { action, reason } = req.body;
    if (!["hide", "unhide", "delete"].includes(action)) {
      res.status(400).json({ error: "Invalid action. Must be: hide, unhide, or delete" });
      return;
    }

    const moderatedId = String(req.params.id);
    const comment = await storage.moderateComment(moderatedId, req.user.id, action, reason);
    logger.info("Comment moderated", {
      commentId: moderatedId,
      action,
      adminId: req.user.id,
    });
    res.json(comment);
  });
}

export const commentController = new CommentController();
