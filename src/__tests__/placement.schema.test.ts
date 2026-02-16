import { placementDocumentSchema, upgradePlacementToV3 } from "@/schemas/placement";

describe("placement schema v3", () => {
  it("accepts valid v2/v3 placement with wrap", () => {
    const result = placementDocumentSchema.safeParse({
      version: 3,
      canvas: { widthMm: 60, heightMm: 40 },
      machine: { strokeWidthWarningThresholdMm: 0.12 },
      wrap: {
        enabled: true,
        diameterMm: 87,
        wrapWidthMm: 273.319,
        seamXmm: 0,
        seamSafeMarginMm: 3,
        microOverlapMm: 0.9
      },
      objects: []
    });

    expect(result.success).toBe(true);
  });

  it("upgrades legacy placement payload to v3", () => {
    const upgraded = upgradePlacementToV3({
      widthMm: 60,
      heightMm: 40,
      offsetXMm: 2,
      offsetYMm: -1,
      rotationDeg: 5,
      anchor: "center"
    });

    expect(upgraded.version).toBe(3);
    expect(upgraded.canvas.widthMm).toBe(60);
    expect(upgraded.objects[0]?.kind).toBe("image");
  });
});
