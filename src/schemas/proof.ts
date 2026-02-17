import { z } from "zod";

export const proofTemplateSchema = z.enum(["40oz_tumbler_wrap"]);

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
  templateId: proofTemplateSchema.default("40oz_tumbler_wrap"),
  placement: proofPlacementSchema,
  highRes: z.boolean().optional()
});

export const proofExportRequestSchema = z.object({
  jobId: z.string().min(1)
});

export type ProofPlacement = z.infer<typeof proofPlacementSchema>;
export type ProofRenderRequest = z.infer<typeof proofRenderRequestSchema>;

export const proofTemplatePresets = {
  "40oz_tumbler_wrap": {
    id: "40oz_tumbler_wrap",
    label: "40oz wrap",
    widthMm: 280,
    heightMm: 110,
    safeMarginMm: 5
  }
} as const;

export type ProofTemplateId = keyof typeof proofTemplatePresets;

export function mmToPx(mm: number, templateId: ProofTemplateId, canvasWidthPx: number) {
  const preset = proofTemplatePresets[templateId];
  return (mm / preset.widthMm) * canvasWidthPx;
}
