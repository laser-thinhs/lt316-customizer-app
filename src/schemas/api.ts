import { z } from "zod";
import { placementDocumentSchema } from "./placement";

export const productProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string()
});

export const productProfilesResponseSchema = z.object({
  data: z.array(productProfileSchema)
});

export const machineProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  lens: z.string()
});

export const designJobSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
  placementJson: placementDocumentSchema,
  productProfile: productProfileSchema,
  machineProfile: machineProfileSchema
});

export const designJobResponseSchema = z.object({
  data: designJobSchema
});

export const preflightIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  objectId: z.string().optional()
});

export const preflightResponseSchema = z.object({
  data: z.object({
    ok: z.boolean(),
    errors: z.array(preflightIssueSchema),
    warnings: z.array(preflightIssueSchema),
    metrics: z.object({
      wrapWidthMm: z.number(),
      seamRiskCount: z.number().int(),
      minStrokeMmObserved: z.number().optional()
    })
  })
});

export type ProductProfile = z.infer<typeof productProfileSchema>;
export type DesignJob = z.infer<typeof designJobSchema>;
export type PreflightResponse = z.infer<typeof preflightResponseSchema>;
