import {
  clampPlacementToZone,
  mmToUv,
  resolveAnchoredRect,
  rotateRectBounds,
  uvToMm,
  validatePlacement
} from "@/lib/geometry/cylinder";
import { PlacementInput } from "@/schemas/placement";

const zone = { xMm: 0, yMm: 0, widthMm: 240, heightMm: 100 };
const basePlacement: PlacementInput = {
  widthMm: 50,
  heightMm: 20,
  offsetXMm: 25,
  offsetYMm: 10,
  rotationDeg: 0,
  anchor: "top-left"
};

describe("cylinder geometry", () => {
  it("resolves anchors correctly", () => {
    expect(resolveAnchoredRect({ ...basePlacement, anchor: "center", offsetXMm: 50, offsetYMm: 50 })).toEqual({
      xMm: 25,
      yMm: 40,
      widthMm: 50,
      heightMm: 20
    });
    expect(resolveAnchoredRect({ ...basePlacement, anchor: "top-right", offsetXMm: 70 })).toEqual({
      xMm: 20,
      yMm: 10,
      widthMm: 50,
      heightMm: 20
    });
  });

  it("clamps negative offsets", () => {
    const clamped = clampPlacementToZone({ ...basePlacement, offsetXMm: -10, offsetYMm: -10 }, zone);
    expect(resolveAnchoredRect(clamped).xMm).toBe(0);
    expect(resolveAnchoredRect(clamped).yMm).toBe(0);
  });

  it("clamps oversized art", () => {
    const clamped = clampPlacementToZone({ ...basePlacement, widthMm: 500, heightMm: 200 }, zone);
    const rect = resolveAnchoredRect(clamped);
    expect(rect.widthMm).toBe(240);
    expect(rect.heightMm).toBe(100);
  });

  it("detects seam-edge placement warning", () => {
    const check = validatePlacement({ ...basePlacement, offsetXMm: 220 }, zone);
    expect(check.ok).toBe(false);
    expect(check.warnings.some((w) => w.includes("right"))).toBe(true);
  });

  it("handles right-angle rotations and arbitrary angle", () => {
    const rect = { xMm: 10, yMm: 10, widthMm: 40, heightMm: 20 };
    expect(rotateRectBounds(rect, 0).widthMm).toBeCloseTo(40, 5);
    expect(rotateRectBounds(rect, 90).widthMm).toBeCloseTo(20, 5);
    expect(rotateRectBounds(rect, 180).widthMm).toBeCloseTo(40, 5);
    expect(rotateRectBounds(rect, 270).widthMm).toBeCloseTo(20, 5);
    expect(rotateRectBounds(rect, 17.5).widthMm).toBeGreaterThan(40);
  });

  it("roundtrips mm <-> uv deterministically", () => {
    const profile = { diameterMm: 76.2, unwrapWidthMm: 239.389, unwrapHeightMm: 100 };
    const uv = mmToUv(239.389, 50, profile);
    expect(uv.u).toBeCloseTo(0, 5);
    const mm = uvToMm(uv.u, uv.v, profile);
    expect(mm.yMm).toBeCloseTo(50, 5);
  });
});
