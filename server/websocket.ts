import { WebSocket, WebSocketServer } from "ws";
import { type Server } from "http";
import { log } from "./vite";
import { logger } from "./logger";
import type { Comment } from "@shared/schema-mongo";

// WebSocket message types
interface ProgressUpdate {
  type: "progress_update";
  projectId: number;
  progress: number;
}

interface NewCommentNotification {
  type: "new_comment";
  projectId: string;
  comment: Comment;
}

interface CommentUpdateNotification {
  type: "comment_update" | "comment_delete" | "comment_like";
  projectId: string;
  commentId: string;
  data?: Partial<Comment>;
}

type WebSocketMessage = ProgressUpdate | NewCommentNotification | CommentUpdateNotification;

// Store the WebSocket server instance for broadcasting from other modules
let wssInstance: WebSocketServer | null = null;

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(message: WebSocketMessage): void {
  if (!wssInstance) {
    logger.warn("WebSocket server not initialized, cannot broadcast");
    return;
  }

  const messageStr = JSON.stringify(message);
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Broadcast a new comment notification
 */
export function broadcastNewComment(comment: Comment): void {
  broadcast({
    type: "new_comment",
    projectId: comment.projectId,
    comment,
  });
}

/**
 * Broadcast a comment update notification
 */
export function broadcastCommentUpdate(
  type: "comment_update" | "comment_delete" | "comment_like",
  projectId: string,
  commentId: string,
  data?: Partial<Comment>,
): void {
  broadcast({
    type,
    projectId,
    commentId,
    data,
  });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  // Store instance for broadcasting
  wssInstance = wss;

  // TODO: Implement multi-node scaling with Redis Pub/Sub
  // Currently, WebSockets only work on a single server instance.
  // For Cloud Run with multiple instances, we need Redis to broadcast across all containers.

  wss.on("connection", (ws) => {
    log("WebSocket client connected");

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;

        if (message.type === "progress_update") {
          // Broadcast the update to all connected clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        }

        // Note: Comments are handled via HTTP endpoints and broadcast from there
        // Clients can subscribe to project-specific updates in the future
      } catch (error) {
        logger.error("Error processing WebSocket message", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ws.on("close", () => {
      log("WebSocket client disconnected");
    });
  });

  return wss;
}
