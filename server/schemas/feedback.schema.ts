import { z } from "zod";

export const submitFeedbackSchema = z.object({
  body: z.object({
    message: z
      .string()
      .min(1, "Feedback message is required")
      .max(5000, "Feedback message is too long"),
  }),
});
