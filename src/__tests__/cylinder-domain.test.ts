import {
  circumferenceMm,
  degreesToMm,
  diameterToWrapWidthMm,
  mmToDegrees,
  roundMm
} from "@/lib/domain/cylinder";

describe("domain cylinder math", () => {
  it("computes circumference/wrap width deterministically", () => {
    expect(circumferenceMm(87)).toBe(273.319);
    expect(diameterToWrapWidthMm(87)).toBe(273.319);
    expect(roundMm(Math.PI * 87)).toBe(273.319);
  });

  it("converts mm and degrees", () => {
    expect(mmToDegrees(136.6595, 273.319)).toBe(180);
    expect(degreesToMm(180, 273.319)).toBe(136.66);
  });
});
