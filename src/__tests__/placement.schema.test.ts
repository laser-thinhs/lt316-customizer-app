import { placementDocumentSchema, upgradePlacementToV2 } from "@/schemas/placement";

describe("placement schema v2", () => {
  it("accepts valid v2 placement with text arc", () => {
    const result = placementDocumentSchema.safeParse({
      version: 2,
      canvas: { widthMm: 60, heightMm: 40 },
      machine: { strokeWidthWarningThresholdMm: 0.12 },
      objects: [
        {
          id: "text_1",
          kind: "text_arc",
          content: "HELLO",
          fontFamily: "Inter",
          fontWeight: 700,
          fontStyle: "normal",
          fontSizeMm: 4,
          lineHeight: 1.2,
          letterSpacingMm: 0.2,
          horizontalAlign: "center",
          verticalAlign: "middle",
          rotationDeg: 0,
          anchor: "center",
          offsetXMm: 5,
          offsetYMm: 4,
          boxWidthMm: 20,
          boxHeightMm: 8,
          fillMode: "fill",
          strokeWidthMm: 0,
          mirrorX: false,
          mirrorY: false,
          zIndex: 1,
          allCaps: true,
          arc: {
            radiusMm: 20,
            startAngleDeg: -60,
            endAngleDeg: 60,
            direction: "cw",
            baselineMode: "center",
            seamWrapMode: "disallow"
          }
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("parses image object with mm placement fields", () => {
    const result = placementDocumentSchema.safeParse({
      version: 2,
      canvas: { widthMm: 100, heightMm: 80 },
      machine: { strokeWidthWarningThresholdMm: 0.12 },
      objects: [
        {
          id: "img_1",
          kind: "image",
          type: "image",
          assetId: "asset_1",
          xMm: 10.01,
          yMm: 20.02,
          widthMm: 30.03,
          heightMm: 15.04,
          rotationDeg: 5,
          lockAspectRatio: true,
          opacity: 0.8
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("upgrades legacy placement payload to v2", () => {
    const upgraded = upgradePlacementToV2({
      widthMm: 60,
      heightMm: 40,
      offsetXMm: 2,
      offsetYMm: -1,
      rotationDeg: 5,
      anchor: "center"
    });

    expect(upgraded.version).toBe(2);
    expect(upgraded.canvas.widthMm).toBe(60);
    expect(upgraded.objects).toHaveLength(0);
  });
});
