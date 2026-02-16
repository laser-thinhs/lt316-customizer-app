import { z } from "zod";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = finiteNumber.positive();

const anchorSchema = z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"]);

const baseObjectSchema = z.object({
  id: z.string().min(1),
  rotationDeg: finiteNumber,
  anchor: anchorSchema,
  offsetXMm: finiteNumber,
  offsetYMm: finiteNumber,
  boxWidthMm: positiveFiniteNumber,
  boxHeightMm: positiveFiniteNumber,
  mirrorX: z.boolean().default(false),
  mirrorY: z.boolean().default(false),
  zIndex: z.number().int().default(0)
});

const typographicSchema = z.object({
  content: z.string(),
  fontFamily: z.string().min(1),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(["normal", "italic"]),
  fontSizeMm: positiveFiniteNumber,
  lineHeight: positiveFiniteNumber.default(1.2),
  letterSpacingMm: finiteNumber,
  horizontalAlign: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  fillMode: z.enum(["fill", "stroke"]),
  strokeWidthMm: finiteNumber.nonnegative().default(0)
});

export const textArcSchema = z.object({
  radiusMm: positiveFiniteNumber,
  startAngleDeg: finiteNumber,
  endAngleDeg: finiteNumber,
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

const imageObjectShape = {
  id: z.string().min(1),
  kind: z.literal("image"),
  type: z.literal("image").default("image"),
  assetId: z.string().min(1),
  xMm: finiteNumber,
  yMm: finiteNumber,
  widthMm: positiveFiniteNumber,
  heightMm: positiveFiniteNumber,
  rotationDeg: finiteNumber.default(0),
  lockAspectRatio: z.boolean().default(true),
  opacity: finiteNumber.min(0).max(1).default(1)
} as const;

export const imageObjectSchema = z.object(imageObjectShape);

const legacyImageObjectSchema = baseObjectSchema
  .extend({
    kind: z.literal("image"),
    src: z.string().min(1)
  })
  .passthrough();

export const vectorObjectSchema = baseObjectSchema.extend({
  kind: z.literal("vector"),
  pathData: z.string().min(1),
  sourceTextObjectId: z.string().optional(),
  sourceMeta: z
    .object({
      fontHash: z.string(),
      conversionTimestamp: z.string(),
      toleranceMm: positiveFiniteNumber
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

const placementDocumentV2Schema = z.object({
  version: z.literal(2),
  canvas: z.object({
    widthMm: positiveFiniteNumber,
    heightMm: positiveFiniteNumber
  }),
  machine: z.object({
    strokeWidthWarningThresholdMm: positiveFiniteNumber.default(0.1)
  }),
  objects: z.array(
    z.union([legacyImageObjectSchema, imageObjectSchema, vectorObjectSchema, textLineObjectSchema, textBlockObjectSchema, textArcObjectSchema])
  )
});

export const placementDocumentSchema = placementDocumentV2Schema.transform((doc) => ({
  ...doc,
  objects: doc.objects.map((entry) => {
    if (entry.kind !== "image") return entry;
    const migrated = imageObjectSchema.safeParse(entry);
    if (migrated.success) return migrated.data;

    const legacy = legacyImageObjectSchema.parse(entry);
    return imageObjectSchema.parse({
      id: legacy.id,
      kind: "image",
      type: "image",
      assetId: legacy.src,
      xMm: legacy.offsetXMm,
      yMm: legacy.offsetYMm,
      widthMm: legacy.boxWidthMm,
      heightMm: legacy.boxHeightMm,
      rotationDeg: legacy.rotationDeg,
      lockAspectRatio: true,
      opacity: 1
    });
  })
}));

const legacyPlacementSchema = z.object({
  widthMm: positiveFiniteNumber,
  heightMm: positiveFiniteNumber,
  offsetXMm: finiteNumber,
  offsetYMm: finiteNumber,
  rotationDeg: finiteNumber,
  anchor: anchorSchema
});

export const placementSchema = z.union([placementDocumentSchema, legacyPlacementSchema]);

export type PlacementDocument = z.infer<typeof placementDocumentSchema>;
export type PlacementObject = z.infer<typeof placementObjectSchema>;
export type TextObject = z.infer<typeof textObjectSchema>;
export type TextArc = z.infer<typeof textArcSchema>;
export type PlacementInput = z.infer<typeof placementSchema>;
export type ImagePlacementObject = z.infer<typeof imageObjectSchema>;

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
    objects: []
  };
}
