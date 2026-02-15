import { z } from "zod";

export const tokenDefinitionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
  validatorRegex: z.string().optional()
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().optional(),
  productProfileId: z.string().nullable().optional(),
  placementDocument: z.record(z.any()),
  previewImagePath: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdBy: z.string().trim().min(1),
  version: z.number().int().positive().default(1),
  tokenDefinitions: z.array(tokenDefinitionSchema).default([])
});

export const patchTemplateSchema = createTemplateSchema.partial().extend({
  tokenDefinitions: z.array(tokenDefinitionSchema).optional()
});

export const applyTemplateSchema = z.object({
  designJobId: z.string().optional(),
  targetProductProfileId: z.string(),
  placementValidationPolicy: z.enum(["STRICT", "CLAMP", "SCALE_TO_FIT"]).default("CLAMP")
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type PatchTemplateInput = z.infer<typeof patchTemplateSchema>;
