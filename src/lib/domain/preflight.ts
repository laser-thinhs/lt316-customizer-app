import { PlacementDocument, PlacementObject } from "@/schemas/placement";
import { roundMm } from "@/lib/domain/cylinder";

export type PreflightIssue = {
  code: string;
  message: string;
  objectId?: string;
};

export type PreflightMetrics = {
  wrapWidthMm: number;
  seamRiskCount: number;
  minStrokeMmObserved?: number;
};

export type PreflightResult = {
  ok: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  metrics: PreflightMetrics;
};

export type ProductProfileLike = {
  id: string;
  name?: string;
};

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function boundsForObject(object: PlacementObject): Bounds {
  const x = object.offsetXMm;
  const y = object.offsetYMm;
  const width = object.boxWidthMm;
  const height = object.boxHeightMm;

  switch (object.anchor) {
    case "center":
      return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
    case "top-left":
      return { minX: x, maxX: x + width, minY: y, maxY: y + height };
    case "top-right":
      return { minX: x - width, maxX: x, minY: y, maxY: y + height };
    case "bottom-left":
      return { minX: x, maxX: x + width, minY: y - height, maxY: y };
    case "bottom-right":
      return { minX: x - width, maxX: x, minY: y - height, maxY: y };
  }
}

function intervalIntersects(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && aMax >= bMin;
}

function objectStrokeWidth(object: PlacementObject): number | undefined {
  return "strokeWidthMm" in object ? object.strokeWidthMm : undefined;
}

export function runPreflight(placement: PlacementDocument, _productProfile: ProductProfileLike): PreflightResult {
  const errors: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  if (placement.objects.length === 0) {
    warnings.push({ code: "EMPTY_DESIGN", message: "Design has no objects." });
  }

  const threshold = placement.machine.strokeWidthWarningThresholdMm ?? 0.1;
  const strokes = placement.objects
    .map(objectStrokeWidth)
    .filter((value): value is number => typeof value === "number");
  const minStrokeMmObserved = strokes.length > 0 ? Math.min(...strokes) : undefined;

  placement.objects.forEach((object) => {
    const bounds = boundsForObject(object);
    if (
      bounds.minX < 0 ||
      bounds.minY < 0 ||
      bounds.maxX > placement.canvas.widthMm ||
      bounds.maxY > placement.canvas.heightMm
    ) {
      errors.push({
        code: "OBJECT_OUT_OF_BOUNDS",
        message: `Object ${object.id} exceeds canvas bounds.`,
        objectId: object.id
      });
    }

    const strokeWidth = objectStrokeWidth(object);
    if (typeof strokeWidth === "number" && strokeWidth < threshold) {
      warnings.push({
        code: "MIN_STROKE_WARNING",
        message: `Object ${object.id} stroke width ${strokeWidth}mm is below threshold ${threshold}mm.`,
        objectId: object.id
      });
    }
  });

  let seamRiskCount = 0;
  let wrapWidthMm = placement.wrap?.wrapWidthMm ?? placement.canvas.widthMm;

  if (placement.wrap?.enabled) {
    const expectedWrap = Math.PI * placement.wrap.diameterMm;
    if (Math.abs(placement.wrap.wrapWidthMm - expectedWrap) > 0.15) {
      errors.push({
        code: "WRAP_WIDTH_MISMATCH",
        message: `wrapWidthMm ${placement.wrap.wrapWidthMm} does not match π*diameter (${roundMm(expectedWrap)}).`
      });
    }

    wrapWidthMm = placement.wrap.wrapWidthMm;
    const seamLines = [placement.wrap.seamXmm, placement.wrap.seamXmm + placement.wrap.wrapWidthMm];

    placement.objects.forEach((object) => {
      const bounds = boundsForObject(object);
      const hit = seamLines.some((line) =>
        intervalIntersects(bounds.minX, bounds.maxX, line - placement.wrap!.seamSafeMarginMm, line + placement.wrap!.seamSafeMarginMm)
      );

      if (hit) {
        seamRiskCount += 1;
        warnings.push({
          code: "SEAM_RISK",
          message: `Object ${object.id} intersects seam safe margin zone.`,
          objectId: object.id
        });
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      wrapWidthMm: roundMm(wrapWidthMm),
      seamRiskCount,
      ...(typeof minStrokeMmObserved === "number" ? { minStrokeMmObserved: roundMm(minStrokeMmObserved) } : {})
    }
  };
}
