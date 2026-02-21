import { generateLightBurnSvg } from "@/core/export/lightburnSvg";
import { objectPresets } from "@/core/v2/presets";

describe("generateLightBurnSvg", () => {
  it("creates mm svg with flattened placement transform and no transform attrs", () => {
    const input = `<svg width="10" height="10"><path d="M0 0 L10 0" stroke="#f00" transform="translate(1,2)"/></svg>`;
    const out = generateLightBurnSvg({
      svgString: input,
      placement: { x_mm: 5, y_mm: 6, scale: 1, rotation_deg: 0, coordinateSpace: "unwrapped_mm", wrapEnabled: false, seamX_mm: 0 },
      objectDefinition: objectPresets.find((p) => p.id === "flat-rect-m") || objectPresets[0],
      bedLayout: { bedW_mm: 100, bedH_mm: 50, grid: { spacing: 10, offsetX: 0, offsetY: 0, enabled: true }, customHoles: [], placedItem: { x: 3, y: 4, rotation: 0 }, rotaryConfig: { axisY: 0, chuckX: 0, tailstockX: 0, enabled: false } },
      origin: "top-left"
    });

    expect(out).toContain('width="100mm"');
    expect(out).toContain('height="50mm"');
    expect(out).toContain('data-export-origin="top-left"');
    expect(out).not.toContain("transform=");
    expect(out).toContain('fill="none"');
  });

  it("uses circumference width for cylinder unwrap exports", () => {
    const input = `<svg viewBox="0 0 20 20"><rect x="0" y="0" width="10" height="10" stroke="#000"/></svg>`;
    const out = generateLightBurnSvg({
      svgString: input,
      placement: { x_mm: 0, y_mm: 0, scale: 1, rotation_deg: 0, coordinateSpace: "unwrapped_mm", wrapEnabled: true, seamX_mm: 0 },
      objectDefinition: objectPresets.find((p) => p.id === "tumbler-20oz") || objectPresets[0],
      origin: "top-left"
    });

    expect(out).toContain('width="229.336mm"');
  });
});
