import { placementSchema, type PlacementInput } from "@/schemas/placement";

type LegacyPlacement = {
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
  anchor: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

function toLegacyPlacement(placement: PlacementInput): LegacyPlacement {
  const parsed = placementSchema.parse(placement);
  if ("widthMm" in parsed) {
    return parsed;
  }

  return {
    widthMm: parsed.canvas.widthMm,
    heightMm: parsed.canvas.heightMm,
    offsetXMm: 0,
    offsetYMm: 0,
    rotationDeg: 0,
    anchor: "top-left"
  };
}

export type ResolvedRectMm = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type ZoneRectMm = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type CylinderProfileMm = {
  diameterMm: number;
  unwrapWidthMm: number;
  unwrapHeightMm: number;
};

/** Returns circumference in millimeters using deterministic floating-point math. */
export function circumferenceMm(diameterMm: number): number {
  return Math.PI * diameterMm;
}

/** Alias for circumference for unwrapped cylinder width in millimeters. */
export function unwrapWidthMm(diameterMm: number): number {
  return circumferenceMm(diameterMm);
}

/** Resolves a placement + anchor into a canonical top-left rectangle. */
export function resolveAnchoredRect(placement: PlacementInput): ResolvedRectMm {
  const parsed = toLegacyPlacement(placement);
  const { widthMm, heightMm, offsetXMm, offsetYMm, anchor } = parsed;

  switch (anchor) {
    case "center":
      return { xMm: offsetXMm - widthMm / 2, yMm: offsetYMm - heightMm / 2, widthMm, heightMm };
    case "top-left":
      return { xMm: offsetXMm, yMm: offsetYMm, widthMm, heightMm };
    case "top-right":
      return { xMm: offsetXMm - widthMm, yMm: offsetYMm, widthMm, heightMm };
    case "bottom-left":
      return { xMm: offsetXMm, yMm: offsetYMm - heightMm, widthMm, heightMm };
    case "bottom-right":
      return { xMm: offsetXMm - widthMm, yMm: offsetYMm - heightMm, widthMm, heightMm };
    default:
      return { xMm: offsetXMm, yMm: offsetYMm, widthMm, heightMm };
  }
}

/** Computes axis-aligned bounds after rotating around center. */
export function rotateRectBounds(rect: ResolvedRectMm, rotationDeg: number): ResolvedRectMm {
  const radians = ((rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = rect.xMm + rect.widthMm / 2;
  const centerY = rect.yMm + rect.heightMm / 2;

  const corners: Array<[number, number]> = [
    [rect.xMm, rect.yMm],
    [rect.xMm + rect.widthMm, rect.yMm],
    [rect.xMm, rect.yMm + rect.heightMm],
    [rect.xMm + rect.widthMm, rect.yMm + rect.heightMm]
  ];

  const rotated = corners.map(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    return [centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos] as const;
  });

  const xs = rotated.map((point) => point[0]);
  const ys = rotated.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { xMm: minX, yMm: minY, widthMm: maxX - minX, heightMm: maxY - minY };
}

function rectWarnings(bounds: ResolvedRectMm, zone: ZoneRectMm): string[] {
  const warnings: string[] = [];
  if (bounds.widthMm > zone.widthMm || bounds.heightMm > zone.heightMm) {
    warnings.push("Artwork bounding box is larger than the safe engrave zone.");
  }
  if (bounds.xMm < zone.xMm) warnings.push("Artwork exceeds left safe-zone boundary.");
  if (bounds.yMm < zone.yMm) warnings.push("Artwork exceeds top safe-zone boundary.");
  if (bounds.xMm + bounds.widthMm > zone.xMm + zone.widthMm) warnings.push("Artwork exceeds right safe-zone boundary.");
  if (bounds.yMm + bounds.heightMm > zone.yMm + zone.heightMm) warnings.push("Artwork exceeds bottom safe-zone boundary.");
  return warnings;
}

function rectToPlacement(rect: ResolvedRectMm, current: PlacementInput): PlacementInput {
  const normalized = toLegacyPlacement(current);
  const { anchor } = normalized;
  switch (anchor) {
    case "center":
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm + rect.widthMm / 2, offsetYMm: rect.yMm + rect.heightMm / 2 };
    case "top-left":
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm, offsetYMm: rect.yMm };
    case "top-right":
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm + rect.widthMm, offsetYMm: rect.yMm };
    case "bottom-left":
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm, offsetYMm: rect.yMm + rect.heightMm };
    case "bottom-right":
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm + rect.widthMm, offsetYMm: rect.yMm + rect.heightMm };
    default:
      return { ...normalized, widthMm: rect.widthMm, heightMm: rect.heightMm, offsetXMm: rect.xMm, offsetYMm: rect.yMm };
  }
}

/** Deterministically clamps the unrotated placement rectangle to the safe zone. */
export function clampPlacementToZone(placement: PlacementInput, zone: ZoneRectMm): PlacementInput {
  const rect = resolveAnchoredRect(placement);
  const clampedWidth = Math.min(rect.widthMm, zone.widthMm);
  const clampedHeight = Math.min(rect.heightMm, zone.heightMm);

  const clampedX = Math.min(Math.max(rect.xMm, zone.xMm), zone.xMm + zone.widthMm - clampedWidth);
  const clampedY = Math.min(Math.max(rect.yMm, zone.yMm), zone.yMm + zone.heightMm - clampedHeight);

  return rectToPlacement({ xMm: clampedX, yMm: clampedY, widthMm: clampedWidth, heightMm: clampedHeight }, placement);
}

/** Validates rotated bounds against safe zone and returns user-facing warnings. */
export function validatePlacement(placement: PlacementInput, zone: ZoneRectMm): { ok: boolean; warnings: string[] } {
  const normalized = toLegacyPlacement(placement);
  const rotatedBounds = rotateRectBounds(resolveAnchoredRect(normalized), normalized.rotationDeg);
  const warnings = rectWarnings(rotatedBounds, zone);
  return { ok: warnings.length === 0, warnings };
}

/** Converts unwrap mm coordinates to UV coordinates in [0..1]. */
export function mmToUv(xMm: number, yMm: number, profile: CylinderProfileMm): { u: number; v: number } {
  const wrappedX = ((xMm % profile.unwrapWidthMm) + profile.unwrapWidthMm) % profile.unwrapWidthMm;
  return { u: wrappedX / profile.unwrapWidthMm, v: Math.min(Math.max(yMm / profile.unwrapHeightMm, 0), 1) };
}

/** Converts UV coordinates in [0..1] back to unwrap mm coordinates. */
export function uvToMm(u: number, v: number, profile: CylinderProfileMm): { xMm: number; yMm: number } {
  const wrappedU = ((u % 1) + 1) % 1;
  return { xMm: wrappedU * profile.unwrapWidthMm, yMm: Math.min(Math.max(v, 0), 1) * profile.unwrapHeightMm };
}
