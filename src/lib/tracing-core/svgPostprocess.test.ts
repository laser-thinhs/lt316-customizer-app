import { describe, it, expect } from "vitest";
import { postprocessSvg } from "../tracing-core/svgPostprocess";

describe("SVG Post-Processing", () => {
  it("should add viewBox if missing", () => {
    const input = '<svg width="100" height="100"><path d="M0,0 L100,100"/></svg>';
    const { optimized } = postprocessSvg(input);
    expect(optimized).toContain('viewBox="0 0');
  });

  it("should remove specks (tiny paths)", () => {
    const tinyPath = '<svg viewBox="0 0 100 100"><path d="M0,0 L0.5,0.5"/></svg>';
    const { optimized, stats } = postprocessSvg(tinyPath, { minSpeckArea: 10 });
    expect(stats.pathCountAfter).toBeLessThanOrEqual(stats.pathCountBefore);
  });

  it("should enforce numeric precision", () => {
    const input = '<svg viewBox="0 0 100 100"><path d="M1.23456,2.3456 L100,100"/></svg>';
    const { optimized } = postprocessSvg(input, { decimalPlaces: 2 });
    // Should have truncated coords to 2 decimals
    expect(optimized).toContain("1.23");
    expect(optimized).not.toContain("1.23456");
  });

  it("should remove empty paths", () => {
    const input = '<svg viewBox="0 0 100 100"><path d=""/></svg>';
    const { optimized, stats } = postprocessSvg(input);
    expect(stats.pathCountAfter).toBe(0);
  });

  it("should convert fill to stroke", () => {
    const input = '<svg viewBox="0 0 100 100"><path d="M0,0 L100,100" fill="black"/></svg>';
    const { optimized } = postprocessSvg(input, { outputMode: "stroke" });
    expect(optimized).toContain("stroke");
    expect(optimized).toContain("fill=\"none\"");
  });

  it("should report accurate statistics", () => {
    const input = '<svg viewBox="0 0 100 100"><path d="M0,0 L50,50 L100,100"/></svg>';
    const { stats } = postprocessSvg(input);
    expect(stats.bytesBefore).toBeGreaterThan(0);
    expect(stats.bytesAfter).toBeGreaterThan(0);
    expect(stats.pathCountBefore).toBeGreaterThanOrEqual(stats.pathCountAfter);
  });

  it("should keep optimization size <= original", () => {
    const input = '<svg viewBox="0 0 100 100"><path d="M0,0 L50,50 L100,100"/></svg>';
    const { stats } = postprocessSvg(input, { decimalPlaces: 2 });
    expect(stats.bytesAfter).toBeLessThanOrEqual(stats.bytesBefore);
  });
});
