import { z } from "zod";
import { placementDocumentSchema } from "./placement";

export const productProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  toolOutlineSvgPath: z.string().nullable().optional()
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
  previewImagePath: z.string().nullable().optional(),
  previewMaskImagePath: z.string().nullable().optional(),
  placementJson: placementDocumentSchema,
  productProfile: productProfileSchema,
  machineProfile: machineProfileSchema
});

export const designJobResponseSchema = z.object({
  data: designJobSchema
});

export type ProductProfile = z.infer<typeof productProfileSchema>;
export type DesignJob = z.infer<typeof designJobSchema>;
