import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../logger";

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("Validation failed", {
          errors: error.issues,
          path: req.path,
          method: req.method,
        });
        const firstError = error.issues[0];
        const errorMessage = firstError ? firstError.message : "Validation failed";

        return res.status(400).json({
          message: errorMessage,
          errors: error.issues.map((e) => ({
            path: e.path,
            message: e.message,
          })),
        });
      }
      return res.status(500).json({ message: "Internal server error during validation" });
    }
  };
};
