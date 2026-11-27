import { z } from "zod";
import { USER_ROLES, ENVIRONMENTS } from "../../shared/schema-mongo";

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z.string().optional(),
    email: z.email("Invalid email address").optional(),
    phoneNumber: z.string().optional(),
    role: z
      .string()
      .optional()
      .refine((val) => !val || (Object.values(USER_ROLES) as string[]).includes(val), {
        message: `Invalid role. Must be one of: ${Object.values(USER_ROLES).join(", ")}`,
      }),
    allowedEnvironment: z.nativeEnum(ENVIRONMENTS).optional(),
  }),
});

export const registerEntitySchema = z.object({
  body: z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email address"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    orgName: z.string().min(1, "Organization name is required"),
    orgDescription: z.string().min(1, "Organization description is required"),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    role: z.literal(USER_ROLES.entity),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});
