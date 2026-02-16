import { arePlacementsEqual } from "@/lib/placement/stableCompare";
import { createDefaultPlacementDocument } from "@/schemas/placement";

describe("stable placement comparison", () => {
  it("treats semantically identical payloads as equal despite key order", () => {
    const left = {
      ...createDefaultPlacementDocument(),
      objects: [
        {
          id: "obj_1",
          kind: "vector" as const,
          rotationDeg: 0,
          anchor: "center" as const,
          offsetXMm: 10,
          offsetYMm: 10,
          boxWidthMm: 20,
          boxHeightMm: 8,
          mirrorX: false,
          mirrorY: false,
          zIndex: 1,
          pathData: "M0 0 L1 0"
        }
      ]
    };

    const right = {
      objects: [
        {
          pathData: "M0 0 L1 0",
          zIndex: 1,
          mirrorY: false,
          mirrorX: false,
          boxHeightMm: 8,
          boxWidthMm: 20,
          offsetYMm: 10,
          offsetXMm: 10,
          anchor: "center" as const,
          rotationDeg: 0,
          kind: "vector" as const,
          id: "obj_1"
        }
      ],
      machine: { strokeWidthWarningThresholdMm: 0.1 },
      canvas: { heightMm: 50, widthMm: 50 },
      version: 2 as const
    };

    expect(arePlacementsEqual(left, right)).toBe(true);
  });
});
