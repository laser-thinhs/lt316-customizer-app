import { buildDefaultImagePlacement } from "@/lib/placement/image-insertion";

describe("buildDefaultImagePlacement", () => {
  it("uses deterministic width and centers object", () => {
    const image = buildDefaultImagePlacement({
      assetId: "asset_1",
      widthPx: 2000,
      heightPx: 1000,
      canvas: { widthMm: 100, heightMm: 80 }
    });

    expect(image.widthMm).toBe(40);
    expect(image.heightMm).toBe(20);
    expect(image.xMm).toBe(30);
    expect(image.yMm).toBe(30);
  });

  it("throws when dimensions are missing", () => {
    expect(() =>
      buildDefaultImagePlacement({
        assetId: "asset_1",
        widthPx: null,
        heightPx: 100,
        canvas: { widthMm: 100, heightMm: 80 }
      })
    ).toThrow("Width and height are required");
  });
});
