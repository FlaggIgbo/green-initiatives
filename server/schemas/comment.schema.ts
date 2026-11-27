import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Comment content is required").max(1000, "Comment too long"),
    parentCommentId: z.string().optional().nullable(),
  }),
  params: z.object({
    id: z.string().min(1, "Project ID is required"),
  }),
});

export const flagCommentSchema = z.object({
  body: z.object({
    reason: z.enum(["spam", "harassment", "inappropriate", "misinformation", "other"]),
    details: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(1, "Comment ID is required"),
  }),
});
