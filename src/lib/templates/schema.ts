import { z } from "zod";

const guideSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("centerline"), axis: z.enum(["x", "y", "both"]).default("both") }),
  z.object({ type: z.literal("grid"), spacingMm: z.number().positive(), color: z.string().optional() }),
  z.object({
    type: z.literal("custom"),
    id: z.string().min(1),
    orientation: z.enum(["horizontal", "vertical"]),
    offsetMm: z.number().nonnegative(),
    color: z.string().optional(),
    label: z.string().optional()
  })
]);

export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  wrapWidthMm: z.number().positive(),
  wrapHeightMm: z.number().positive(),
  defaultDpi: z.number().int().positive(),
  bleedMm: z.number().nonnegative().optional(),
  safeMarginMm: z.number().nonnegative().optional(),
  previewMockup: z.object({ assetId: z.string().optional(), url: z.string().url().optional() }).optional(),
  guides: z.array(guideSchema).default([])
});

export type TemplateGuide = z.infer<typeof guideSchema>;
export type Template = z.infer<typeof templateSchema>;
export const templateRegistrySchema = z.array(templateSchema);
