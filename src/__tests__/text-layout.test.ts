import {
  clampTextPlacementToZone,
  computeTextBoundsMm,
  layoutTextArcMm,
  layoutTextBlockMm,
  measureTextLineMm,
  validateTextPlacement
} from "@/lib/geometry/textLayout";
import { TextObject } from "@/schemas/placement";

const baseText: TextObject = {
  id: "text-1",
  kind: "text_line",
  content: "LT316",
  fontFamily: "Inter",
  fontWeight: 400,
  fontStyle: "normal",
  fontSizeMm: 4,
  lineHeight: 1.2,
  letterSpacingMm: 0.1,
  horizontalAlign: "left",
  verticalAlign: "top",
  rotationDeg: 45,
  anchor: "center",
  offsetXMm: 55,
  offsetYMm: -1,
  boxWidthMm: 20,
  boxHeightMm: 8,
  fillMode: "stroke",
  strokeWidthMm: 0.05,
  mirrorX: false,
  mirrorY: false,
  zIndex: 1,
  allCaps: false
};

describe("text layout", () => {
  it("measures line deterministically", () => {
    expect(measureTextLineMm({ content: "AB", fontSizeMm: 5, letterSpacingMm: 0.2 })).toEqual({
      content: "AB",
      widthMm: 6.4,
      heightMm: 5
    });
  });

  it("handles multiline block layout", () => {
    const block = layoutTextBlockMm({ content: "A\nBC", fontSizeMm: 4, letterSpacingMm: 0, lineHeight: 1.5 });
    expect(block.heightMm).toBe(12);
    expect(block.widthMm).toBeCloseTo(4.96);
  });

  it("validates arc text edge cases", () => {
    const arc = layoutTextArcMm({
      content: "CURVED TEXT",
      fontSizeMm: 4,
      letterSpacingMm: 0.1,
      arc: {
        radiusMm: 8,
        startAngleDeg: -10,
        endAngleDeg: 10,
        direction: "cw",
        baselineMode: "center",
        seamWrapMode: "disallow"
      }
    });

    expect(arc.fitsArc).toBe(false);
  });

  it("computes rotation-aware bounds and clamp", () => {
    const bounds = computeTextBoundsMm(baseText);
    expect(bounds.widthMm).toBeGreaterThan(19);

    const clamped = clampTextPlacementToZone(baseText, { widthMm: 60, heightMm: 40 });
    expect(clamped.offsetXMm).toBe(40);
    expect(clamped.offsetYMm).toBe(0);
  });

  it("returns engraving warnings", () => {
    const warnings = validateTextPlacement({
      object: baseText,
      zone: { widthMm: 60, heightMm: 40 },
      strokeWidthWarningThresholdMm: 0.1
    });

    expect(warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["TEXT_OUTSIDE_ZONE", "STROKE_TOO_THIN"]));
  });

  it("snapshot text transforms", () => {
    expect({
      measured: measureTextLineMm({ content: "SNAP", fontSizeMm: 4, letterSpacingMm: 0.2 }),
      bounds: computeTextBoundsMm(baseText)
    }).toMatchSnapshot();
  });
});
