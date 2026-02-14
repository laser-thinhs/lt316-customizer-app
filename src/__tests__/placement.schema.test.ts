import { placementSchema } from "@/schemas/placement";

describe("placementSchema", () => {
  it("accepts valid placement in mm", () => {
    const result = placementSchema.safeParse({
      widthMm: 60,
      heightMm: 40,
      offsetXMm: 2,
      offsetYMm: -1.5,
      rotationDeg: 15,
      anchor: "center"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid anchor", () => {
    const result = placementSchema.safeParse({
      widthMm: 60,
      heightMm: 40,
      offsetXMm: 0,
      offsetYMm: 0,
      rotationDeg: 0,
      anchor: "middle"
    });

    expect(result.success).toBe(false);
  });
});
