import { AppError } from "@/lib/errors";
import { buildFontHash } from "@/lib/fonts/registry";
import { PlacementDocument, TextObject, placementDocumentSchema } from "@/schemas/placement";

export type OutlineConversionResult = {
  derivedVectorObject: PlacementDocument["objects"][number];
  warnings: string[];
};

function buildRectPath(widthMm: number, heightMm: number) {
  return `M0 0 L${widthMm.toFixed(3)} 0 L${widthMm.toFixed(3)} ${heightMm.toFixed(3)} L0 ${heightMm.toFixed(3)} Z`;
}

export function convertTextObjectToOutline(input: {
  placement: unknown;
  objectId: string;
  toleranceMm?: number;
}): OutlineConversionResult {
  const placement = placementDocumentSchema.parse(input.placement);
  const toleranceMm = input.toleranceMm ?? 0.05;

  const source = placement.objects.find((object) => object.id === input.objectId);
  if (!source) throw new AppError("Text object not found", 404, "TEXT_OBJECT_NOT_FOUND");
  if (!(source.kind === "text_line" || source.kind === "text_block" || source.kind === "text_arc")) {
    throw new AppError("Only text objects can be outlined", 400, "INVALID_OUTLINE_SOURCE");
  }

  const textObject = source as TextObject;
  if (textObject.content.trim().length === 0) {
    throw new AppError("Cannot outline empty text", 400, "EMPTY_TEXT_CONTENT");
  }

  const vectorId = `${source.id}-outline`;
  const derived = {
    id: vectorId,
    kind: "vector" as const,
    pathData: buildRectPath(source.boxWidthMm, source.boxHeightMm),
    sourceTextObjectId: source.id,
    sourceMeta: {
      fontHash: buildFontHash(source.fontFamily, source.fontWeight, source.fontStyle),
      conversionTimestamp: new Date().toISOString(),
      toleranceMm
    },
    rotationDeg: source.rotationDeg,
    anchor: source.anchor,
    offsetXMm: source.offsetXMm,
    offsetYMm: source.offsetYMm,
    boxWidthMm: source.boxWidthMm,
    boxHeightMm: source.boxHeightMm,
    mirrorX: source.mirrorX,
    mirrorY: source.mirrorY,
    visible: true,
    locked: false,
    zIndex: source.zIndex + 1
  };

  return {
    derivedVectorObject: derived,
    warnings: [
      "Deterministic placeholder outline generated. Integrate font glyph path extraction before production export."
    ]
  };
}
