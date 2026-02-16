import { AppError } from "@/lib/errors";
import type { ImagePlacementObject, PlacementDocument } from "@/schemas/placement";

const PRECISION = 100;

function roundMm(value: number) {
  return Math.round(value * PRECISION) / PRECISION;
}

function clampPositive(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("Image dimensions must be finite positive numbers.", 400, "INVALID_IMAGE_DIMENSIONS");
  }
  return value;
}

export function buildDefaultImagePlacement(params: {
  assetId: string;
  widthPx: number | null;
  heightPx: number | null;
  canvas: PlacementDocument["canvas"];
}): ImagePlacementObject {
  const { assetId, widthPx, heightPx, canvas } = params;
  if (!widthPx || !heightPx) {
    throw new AppError("Image metadata is incomplete. Width and height are required.", 400, "MISSING_ASSET_DIMENSIONS");
  }

  const safeWidthPx = clampPositive(widthPx);
  const safeHeightPx = clampPositive(heightPx);
  const defaultWidthMm = Math.min(40, canvas.widthMm * 0.4);
  const aspectRatio = safeHeightPx / safeWidthPx;
  const widthMm = clampPositive(defaultWidthMm);
  const heightMm = clampPositive(defaultWidthMm * aspectRatio);

  return {
    id: `img-${assetId}`,
    kind: "image",
    type: "image",
    assetId,
    xMm: roundMm((canvas.widthMm - widthMm) / 2),
    yMm: roundMm((canvas.heightMm - heightMm) / 2),
    widthMm: roundMm(widthMm),
    heightMm: roundMm(heightMm),
    rotationDeg: 0,
    lockAspectRatio: true,
    opacity: 1
  };
}
