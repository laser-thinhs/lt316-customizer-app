import { runPreflight } from "@/lib/domain/preflight";
import { PlacementDocument } from "@/schemas/placement";

const baseDoc: PlacementDocument = {
  version: 3,
  canvas: { widthMm: 100, heightMm: 50 },
  machine: { strokeWidthWarningThresholdMm: 0.1 },
  wrap: {
    enabled: true,
    diameterMm: 87,
    wrapWidthMm: 273.319,
    seamXmm: 0,
    seamSafeMarginMm: 3,
    microOverlapMm: 0.9
  },
  objects: [
    {
      id: "txt-1",
      kind: "text_line",
      content: "Hello",
      fontFamily: "Inter",
      fontWeight: 400,
      fontStyle: "normal",
      fontSizeMm: 4,
      lineHeight: 1.2,
      letterSpacingMm: 0,
      horizontalAlign: "left",
      verticalAlign: "top",
      fillMode: "stroke",
      strokeWidthMm: 0.08,
      rotationDeg: 0,
      anchor: "top-left",
      offsetXMm: 1,
      offsetYMm: 2,
      boxWidthMm: 20,
      boxHeightMm: 5,
      mirrorX: false,
      mirrorY: false,
      zIndex: 1,
      allCaps: false
    }
  ]
};

describe("preflight", () => {
  it("warns for seam risk and min stroke", () => {
    const result = runPreflight(baseDoc, { id: "prod_1" });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "SEAM_RISK")).toBe(true);
    expect(result.warnings.some((w) => w.code === "MIN_STROKE_WARNING")).toBe(true);
    expect(result.metrics.seamRiskCount).toBe(1);
  });

  it("errors for wrap mismatch and out of bounds", () => {
    const result = runPreflight(
      {
        ...baseDoc,
        wrap: { ...baseDoc.wrap!, wrapWidthMm: 280 },
        objects: [{ ...baseDoc.objects[0], id: "out", offsetXMm: 95, boxWidthMm: 15 }]
      },
      { id: "prod_1" }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "WRAP_WIDTH_MISMATCH")).toBe(true);
    expect(result.errors.some((e) => e.code === "OBJECT_OUT_OF_BOUNDS")).toBe(true);
  });
});
