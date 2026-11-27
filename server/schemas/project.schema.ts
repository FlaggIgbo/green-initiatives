import { z } from "zod";
import { APPROVAL_STATUS, ENVIRONMENTS } from "../../shared/schema-mongo";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(1, "Address is required"),
});

const timelinePhaseSchema = z.object({
  phase: z.string().min(1),
  duration: z.string().min(1),
  deliverables: z.string().min(1),
});

const fundingBreakdownSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
});

const measurableImpactSchema = z.object({
  metric: z.string().min(1),
  targetValue: z.number().positive(),
  trackingMethod: z.string().min(1),
});

const proposalSchema = z.object({
  objectives: z.string().min(10),
  methodology: z.string().min(10),
  timeline: z.array(timelinePhaseSchema).min(1),
  fundingBreakdown: z.array(fundingBreakdownSchema).min(1),
  measurableImpact: measurableImpactSchema,
  supportingDocuments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string(),
      }),
    )
    .optional(),
});

export const createProjectSchema = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    organizationId: z.string().min(1, "Organization ID is required"),
    location: locationSchema,
    imageUrl: z.string().url("Invalid image URL"),
    targetFunding: z
      .number()
      .positive("Target funding must be positive when provided")
      .optional()
      .nullable(),
    status: z.string().min(1, "Status is required"),
    allowedEnvironments: z.array(z.nativeEnum(ENVIRONMENTS)).optional(),
    proposal: proposalSchema,
  }),
});

export const updateApprovalStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(APPROVAL_STATUS),
  }),
  params: z.object({
    id: z.string().min(1, "Project ID is required"),
  }),
});

export const fundProjectSchema = z.object({
  body: z.object({
    amount: z.number().positive("Amount must be positive"),
  }),
  params: z.object({
    id: z.string().min(1, "Project ID is required"),
  }),
});
