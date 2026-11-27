import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { getProject, getProjects } from "../features/projects/projectSlice";
import { getWebSocketUrl } from "@/lib/api-config";
import { clientLogger } from "@/lib/logger";
import { AppDispatch } from "../app/store";

export function useProjectUpdates() {
  const ws = useRef<WebSocket | null>(null);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Connect to WebSocket server (supports both same-origin and external API)
    ws.current = new WebSocket(getWebSocketUrl());

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "progress_update") {
          // Refetch project data to trigger UI updates
          dispatch(getProject(message.projectId));
          dispatch(getProjects());
        }
      } catch (error) {
        clientLogger.error("Error processing WebSocket message", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    ws.current.onclose = () => {
      // Do nothing
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [dispatch]);

  const sendProgressUpdate = (projectId: string, progress: number) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "progress_update",
          projectId,
          progress,
        }),
      );
    }
  };

  return { sendProgressUpdate };
}
