import { z } from "zod";
import { diameterToWrapWidthMm, roundMm } from "@/lib/domain/cylinder";

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
export const wrapSchema = z.object({
  enabled: z.boolean().default(false),
  diameterMm: z.number().positive(),
  wrapWidthMm: z.number().positive(),
  seamXmm: z.number().default(0),
  seamSafeMarginMm: z.number().positive().default(3),
  microOverlapMm: z.number().nonnegative().default(0.9)
});

const placementDocumentBaseSchema = z.object({
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
  objects: z.array(placementObjectSchema),
  wrap: wrapSchema.optional()
});

const placementDocumentV2Schema = placementDocumentBaseSchema.extend({ version: z.literal(2) });
const placementDocumentV3Schema = placementDocumentBaseSchema.extend({ version: z.literal(3) });

export const placementDocumentSchema = z.union([placementDocumentV2Schema, placementDocumentV3Schema]);

const legacyPlacementSchema = z.object({
  widthMm: positiveFiniteNumber,
  heightMm: positiveFiniteNumber,
  offsetXMm: finiteNumber,
  offsetYMm: finiteNumber,
  rotationDeg: finiteNumber,
  anchor: anchorSchema
});

export const placementSchema = z.union([placementDocumentSchema, legacyPlacementSchema]);

export type PlacementDocument = z.infer<typeof placementDocumentV3Schema>;
export type PlacementObject = z.infer<typeof placementObjectSchema>;
export type TextObject = z.infer<typeof textObjectSchema>;
export type TextArc = z.infer<typeof textArcSchema>;
export type PlacementInput = z.infer<typeof placementSchema>;
export type ImagePlacementObject = z.infer<typeof imageObjectSchema>;
export type PlacementWrap = z.infer<typeof wrapSchema>;

export function createDefaultPlacementDocument(): PlacementDocument {
  return {
    version: 3,
    canvas: { widthMm: 50, heightMm: 50 },
    machine: { strokeWidthWarningThresholdMm: 0.1 },
    objects: [],
    wrap: {
      enabled: false,
      diameterMm: 87,
      wrapWidthMm: diameterToWrapWidthMm(87),
      seamXmm: 0,
      seamSafeMarginMm: 3,
      microOverlapMm: 0.9
    }
  };
}

function normalizeWrap(raw: unknown): PlacementWrap | undefined {
  const parsed = wrapSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  const wrapWidthMm = diameterToWrapWidthMm(parsed.data.diameterMm);
  return {
    ...parsed.data,
    wrapWidthMm: roundMm(wrapWidthMm)
  };
}

export function upgradePlacementToV3(input: PlacementInput): PlacementDocument {
  const parsedDoc = placementDocumentSchema.safeParse(input);
  if (parsedDoc.success) {
    return {
      ...parsedDoc.data,
      version: 3,
      wrap: normalizeWrap(parsedDoc.data.wrap)
    };
  }

  const legacy = legacyPlacementSchema.parse(input);
  return {
    version: 3,
    canvas: {
      widthMm: legacy.widthMm,
      heightMm: legacy.heightMm
    },
    machine: { strokeWidthWarningThresholdMm: 0.1 },
    objects: []
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
    ],
    wrap: undefined
  };
}
