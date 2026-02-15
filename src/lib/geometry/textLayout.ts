import { TextArc, TextObject } from "@/schemas/placement";
import { getUnsupportedGlyphs } from "@/lib/fonts/registry";

export type BoundsMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };
export type LayoutWarningCode =
  | "TEXT_OUTSIDE_ZONE"
  | "ARC_RADIUS_TOO_SMALL"
  | "ARC_SPAN_TOO_SHORT"
  | "SEAM_CROSSING_RISK"
  | "MISSING_GLYPHS"
  | "STROKE_TOO_THIN";

export type LayoutWarning = { code: LayoutWarningCode; message: string };

const CHAR_WIDTH_RATIO = 0.62;

export function measureTextLineMm(input: {
  content: string;
  fontSizeMm: number;
  letterSpacingMm: number;
  allCaps?: boolean;
}) {
  const normalized = input.allCaps ? input.content.toUpperCase() : input.content;
  const chars = normalized.length;
  const widthMm = chars === 0 ? 0 : chars * input.fontSizeMm * CHAR_WIDTH_RATIO + (chars - 1) * input.letterSpacingMm;
  return { content: normalized, widthMm, heightMm: input.fontSizeMm };
}

export function layoutTextBlockMm(input: {
  content: string;
  fontSizeMm: number;
  letterSpacingMm: number;
  lineHeight: number;
  allCaps?: boolean;
}) {
  const lines = input.content.split("\n");
  const measured = lines.map((line) => measureTextLineMm({ ...input, content: line }));
  const widthMm = Math.max(0, ...measured.map((entry) => entry.widthMm));
  const lineHeightMm = input.fontSizeMm * input.lineHeight;
  const heightMm = measured.length * lineHeightMm;

  return { lines: measured, widthMm, heightMm, lineHeightMm };
}

export function layoutTextArcMm(input: {
  content: string;
  fontSizeMm: number;
  letterSpacingMm: number;
  arc: TextArc;
  allCaps?: boolean;
}) {
  const line = measureTextLineMm(input);
  const spanDeg = Math.abs(input.arc.endAngleDeg - input.arc.startAngleDeg);
  const arcLengthMm = (Math.PI * 2 * input.arc.radiusMm * spanDeg) / 360;
  const seamCrossing =
    (input.arc.startAngleDeg < 0 && input.arc.endAngleDeg > 0) ||
    (input.arc.startAngleDeg < 360 && input.arc.endAngleDeg > 360);

  return {
    ...line,
    spanDeg,
    arcLengthMm,
    seamCrossing,
    fitsArc: line.widthMm <= arcLengthMm
  };
}

export function computeTextBoundsMm(object: TextObject): BoundsMm {
  const base = { xMm: object.offsetXMm, yMm: object.offsetYMm, widthMm: object.boxWidthMm, heightMm: object.boxHeightMm };
  if (object.rotationDeg === 0) return base;
  const angle = (Math.PI * object.rotationDeg) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    xMm: object.offsetXMm,
    yMm: object.offsetYMm,
    widthMm: object.boxWidthMm * cos + object.boxHeightMm * sin,
    heightMm: object.boxWidthMm * sin + object.boxHeightMm * cos
  };
}

export function clampTextPlacementToZone(object: TextObject, zone: { widthMm: number; heightMm: number }) {
  const clampedX = Math.min(Math.max(object.offsetXMm, 0), zone.widthMm - object.boxWidthMm);
  const clampedY = Math.min(Math.max(object.offsetYMm, 0), zone.heightMm - object.boxHeightMm);
  return { ...object, offsetXMm: clampedX, offsetYMm: clampedY };
}

export function validateTextPlacement(input: {
  object: TextObject;
  zone: { widthMm: number; heightMm: number };
  seamXMm?: number;
  strokeWidthWarningThresholdMm: number;
}) {
  const warnings: LayoutWarning[] = [];
  const bounds = computeTextBoundsMm(input.object);

  if (
    bounds.xMm < 0 ||
    bounds.yMm < 0 ||
    bounds.xMm + bounds.widthMm > input.zone.widthMm ||
    bounds.yMm + bounds.heightMm > input.zone.heightMm
  ) {
    warnings.push({ code: "TEXT_OUTSIDE_ZONE", message: "Text bounds exceed engrave zone." });
  }

  if (input.object.fillMode === "stroke" && input.object.strokeWidthMm < input.strokeWidthWarningThresholdMm) {
    warnings.push({ code: "STROKE_TOO_THIN", message: "Stroke width may be too thin for reliable engraving." });
  }

  const unsupported = getUnsupportedGlyphs(input.object.content);
  if (unsupported.length) {
    warnings.push({ code: "MISSING_GLYPHS", message: `Missing glyphs detected: ${unsupported.join(" ")}` });
  }

  if (input.object.kind === "text_arc") {
    const arcLayout = layoutTextArcMm({
      content: input.object.content,
      fontSizeMm: input.object.fontSizeMm,
      letterSpacingMm: input.object.letterSpacingMm,
      arc: input.object.arc,
      allCaps: input.object.allCaps
    });

    if (input.object.arc.radiusMm < input.object.fontSizeMm * 0.6) {
      warnings.push({ code: "ARC_RADIUS_TOO_SMALL", message: "Arc radius is too small for selected font size." });
    }

    if (!arcLayout.fitsArc) {
      warnings.push({ code: "ARC_SPAN_TOO_SHORT", message: "Arc span is too short for the current content." });
    }

    if (arcLayout.seamCrossing) {
      warnings.push({ code: "SEAM_CROSSING_RISK", message: "Arc text crosses seam boundary." });
    }
  }

  return warnings;
}
