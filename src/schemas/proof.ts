import { z } from "zod";

export const proofTemplateSchema = z.enum(["40oz_tumbler_wrap"]);

export const proofBlendModeSchema = z.enum(["normal", "multiply"]);

export const proofTransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive().max(20).default(1),
  rotation: z.number().min(-360).max(360).default(0),
  flipH: z.boolean().default(false),
  flipV: z.boolean().default(false)
});

const baseItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).default("Layer"),
  transformMm: proofTransformSchema,
  opacity: z.number().min(0).max(1).default(1),
  blendMode: proofBlendModeSchema.optional(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false)
});

export const proofSvgItemSchema = baseItemSchema.extend({
  type: z.literal("svg"),
  assetId: z.string().min(1)
});

export const proofImageItemSchema = baseItemSchema.extend({
  type: z.literal("image"),
  assetId: z.string().min(1)
});

export const proofTextItemSchema = baseItemSchema.extend({
  type: z.literal("text"),
  text: z.string().min(1).max(400)
});

export const proofCompositionItemSchema = z.discriminatedUnion("type", [
  proofSvgItemSchema,
  proofImageItemSchema,
  proofTextItemSchema
]);

export const proofGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  itemIds: z.array(z.string().min(1)).default([])
});

export const MAX_COMPOSITION_ITEMS = 25;

export const proofCompositionSchema = z.object({
  templateId: proofTemplateSchema.default("40oz_tumbler_wrap"),
  dpi: z.number().int().positive().max(1200).default(300),
  items: z.array(proofCompositionItemSchema).max(MAX_COMPOSITION_ITEMS),
  order: z.array(z.string().min(1)).default([]),
  groups: z.array(proofGroupSchema).optional()
}).superRefine((value, ctx) => {
  const itemIds = new Set(value.items.map((item) => item.id));
  for (const id of value.order) {
    if (!itemIds.has(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `order contains unknown item id: ${id}` });
    }
  }
});

export const proofRenderRequestSchema = z.object({
  composition: proofCompositionSchema,
  highRes: z.boolean().optional()
});

export const proofExportRequestSchema = z.object({
  jobId: z.string().min(1)
});

export type ProofComposition = z.infer<typeof proofCompositionSchema>;
export type ProofCompositionItem = z.infer<typeof proofCompositionItemSchema>;
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

export function createSingleItemComposition(input: { svgAssetId: string; templateId?: ProofTemplateId; placement?: { scalePercent: number; rotateDeg: number; xMm: number; yMm: number; mirrorH: boolean; mirrorV: boolean } }): ProofComposition {
  const templateId = input.templateId ?? "40oz_tumbler_wrap";
  const placement = input.placement ?? {
    scalePercent: 100,
    rotateDeg: 0,
    xMm: proofTemplatePresets[templateId].widthMm / 2,
    yMm: proofTemplatePresets[templateId].heightMm / 2,
    mirrorH: false,
    mirrorV: false
  };

  const itemId = "item-1";
  return {
    templateId,
    dpi: 300,
    items: [{
      id: itemId,
      name: "Traced SVG",
      type: "svg",
      assetId: input.svgAssetId,
      transformMm: {
        x: placement.xMm,
        y: placement.yMm,
        scale: placement.scalePercent / 100,
        rotation: placement.rotateDeg,
        flipH: placement.mirrorH,
        flipV: placement.mirrorV
      },
      opacity: 1,
      locked: false,
      hidden: false,
      blendMode: "normal"
    }],
    order: [itemId],
    groups: []
  };
}
