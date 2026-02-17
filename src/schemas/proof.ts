import { z } from "zod";
import { defaultTemplateId, templates } from "@/lib/templates";
import { templateSchema } from "@/lib/templates/schema";

const templateIds = templates.map((template) => template.id) as [string, ...string[]];

export const proofTemplateSchema = z.enum(templateIds);

export const proofPlacementSchema = z.object({
  scalePercent: z.number().min(1).max(500),
  rotateDeg: z.number().min(-360).max(360),
  xMm: z.number(),
  yMm: z.number(),
  mirrorH: z.boolean(),
  mirrorV: z.boolean(),
  repeatMode: z.enum(["none", "step-and-repeat"]),
  stepMm: z.number().positive().max(200).default(20)
});

export const proofRenderRequestSchema = z.object({
  svgAssetId: z.string().min(1),
  templateId: proofTemplateSchema.default(defaultTemplateId),
  dpi: z.number().positive().int().optional(),
  placementMm: proofPlacementSchema.optional(),
  placement: proofPlacementSchema.optional(),
  highRes: z.boolean().optional()
}).transform((value) => ({
  ...value,
  placementMm: value.placementMm ?? value.placement
})).pipe(z.object({
  svgAssetId: z.string().min(1),
  templateId: proofTemplateSchema,
  dpi: z.number().positive().int().optional(),
  placementMm: proofPlacementSchema,
  placement: proofPlacementSchema.optional(),
  highRes: z.boolean().optional()
}));

export const proofExportRequestSchema = z.object({
  jobId: z.string().min(1)
});

export const proofUiSettingsSchema = z.object({
  gridEnabled: z.boolean().default(true),
  gridSpacingMm: z.number().positive().default(10),
  snapToGrid: z.boolean().default(true),
  snapToCenterlines: z.boolean().default(true),
  snapToSafeBounds: z.boolean().default(false)
});

export type ProofPlacement = z.infer<typeof proofPlacementSchema>;
export type ProofRenderRequest = z.infer<typeof proofRenderRequestSchema>;
export type ProofTemplate = z.infer<typeof templateSchema>;
export type ProofTemplateId = z.infer<typeof proofTemplateSchema>;

export const proofTemplatePresets = Object.fromEntries(
  templates.map((template) => [template.id, {
    id: template.id,
    label: template.name,
    widthMm: template.wrapWidthMm,
    heightMm: template.wrapHeightMm,
    safeMarginMm: template.safeMarginMm ?? 0,
    bleedMm: template.bleedMm ?? 0,
    defaultDpi: template.defaultDpi,
    guides: template.guides
  }])
) as Record<ProofTemplateId, {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  safeMarginMm: number;
  bleedMm: number;
  defaultDpi: number;
  guides: ProofTemplate["guides"];
}>;
