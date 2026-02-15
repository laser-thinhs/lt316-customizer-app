import { z } from "zod";

const anchorSchema = z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"]);

const baseObjectSchema = z.object({
  id: z.string().min(1),
  rotationDeg: z.number(),
  anchor: anchorSchema,
  offsetXMm: z.number(),
  offsetYMm: z.number(),
  boxWidthMm: z.number().positive(),
  boxHeightMm: z.number().positive(),
  mirrorX: z.boolean().default(false),
  mirrorY: z.boolean().default(false),
  zIndex: z.number().int().default(0)
});

const typographicSchema = z.object({
  content: z.string(),
  fontFamily: z.string().min(1),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(["normal", "italic"]),
  fontSizeMm: z.number().positive(),
  lineHeight: z.number().positive().default(1.2),
  letterSpacingMm: z.number(),
  horizontalAlign: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  fillMode: z.enum(["fill", "stroke"]),
  strokeWidthMm: z.number().nonnegative().default(0)
});

export const textArcSchema = z.object({
  radiusMm: z.number().positive(),
  startAngleDeg: z.number(),
  endAngleDeg: z.number(),
  direction: z.enum(["cw", "ccw"]),
  baselineMode: z.enum(["inside", "center", "outside"]),
  seamWrapMode: z.enum(["disallow", "split"]).default("disallow")
});

export const textLineObjectSchema = baseObjectSchema.extend(typographicSchema.shape).extend({
  kind: z.literal("text_line"),
  allCaps: z.boolean().default(false)
});

export const textBlockObjectSchema = baseObjectSchema.extend(typographicSchema.shape).extend({
  kind: z.literal("text_block"),
  allCaps: z.boolean().default(false)
});

export const textArcObjectSchema = baseObjectSchema.extend(typographicSchema.shape).extend({
  kind: z.literal("text_arc"),
  arc: textArcSchema,
  allCaps: z.boolean().default(false)
});

export const textObjectSchema = z.discriminatedUnion("kind", [
  textLineObjectSchema,
  textBlockObjectSchema,
  textArcObjectSchema
]);

export const imageObjectSchema = baseObjectSchema.extend({
  kind: z.literal("image"),
  src: z.string().min(1)
});

export const vectorObjectSchema = baseObjectSchema.extend({
  kind: z.literal("vector"),
  pathData: z.string().min(1),
  sourceTextObjectId: z.string().optional(),
  sourceMeta: z
    .object({
      fontHash: z.string(),
      conversionTimestamp: z.string(),
      toleranceMm: z.number().positive()
    })
    .optional()
});

export const placementObjectSchema = z.union([
  imageObjectSchema,
  vectorObjectSchema,
  textLineObjectSchema,
  textBlockObjectSchema,
  textArcObjectSchema
]);

export const placementDocumentSchema = z.object({
  version: z.literal(2),
  canvas: z.object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive()
  }),
  machine: z.object({
    strokeWidthWarningThresholdMm: z.number().positive().default(0.1)
  }),
  objects: z.array(placementObjectSchema)
});

const legacyPlacementSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  offsetXMm: z.number(),
  offsetYMm: z.number(),
  rotationDeg: z.number(),
  anchor: anchorSchema
});

export const placementSchema = z.union([placementDocumentSchema, legacyPlacementSchema]);

export type PlacementDocument = z.infer<typeof placementDocumentSchema>;
export type PlacementObject = z.infer<typeof placementObjectSchema>;
export type TextObject = z.infer<typeof textObjectSchema>;
export type TextArc = z.infer<typeof textArcSchema>;
export type PlacementInput = z.infer<typeof placementSchema>;

export function createDefaultPlacementDocument(): PlacementDocument {
  return {
    version: 2,
    canvas: { widthMm: 50, heightMm: 50 },
    machine: { strokeWidthWarningThresholdMm: 0.1 },
    objects: []
  };
}

export function upgradePlacementToV2(input: PlacementInput): PlacementDocument {
  const parsedV2 = placementDocumentSchema.safeParse(input);
  if (parsedV2.success) return parsedV2.data;

  const legacy = legacyPlacementSchema.parse(input);
  return {
    version: 2,
    canvas: {
      widthMm: legacy.widthMm,
      heightMm: legacy.heightMm
    },
    machine: { strokeWidthWarningThresholdMm: 0.1 },
    objects: [
      {
        id: "legacy-image-slot",
        kind: "image",
        src: "/stub/uploads/not-implemented.svg",
        boxWidthMm: legacy.widthMm,
        boxHeightMm: legacy.heightMm,
        offsetXMm: legacy.offsetXMm,
        offsetYMm: legacy.offsetYMm,
        rotationDeg: legacy.rotationDeg,
        anchor: legacy.anchor,
        mirrorX: false,
        mirrorY: false,
        zIndex: 0
      }
    ]
  };
}
