import { normalizeSvg, TracerSettingsSchema } from "../../lib/tracing-core";

describe("tracing-core", () => {
  it("applies sane defaults", () => {
    const parsed = TracerSettingsSchema.parse({});

    expect(parsed.threshold).toBe(165);
    expect(parsed.output).toBe("fill");
    expect(parsed.removeBackground).toBe(true);
    expect(parsed.strokeWidth).toBeUndefined();
  });

  it("normalizes stroke defaults", () => {
    const parsed = TracerSettingsSchema.parse({ output: "stroke" });
    expect(parsed.strokeWidth).toBe(1);
  });

  it("normalizes svg dimensions and strips tiny specks", () => {
    const input = '<svg width="20pt" height="10pt"><metadata>bad</metadata><path d="M1 1 L2 1 L2 2 Z"/><path d="M0 0 L10 0 L10 10 Z"/></svg>';
    const result = normalizeSvg(input, 20, 10, 6);

    expect(result.svg).toContain('width="20px"');
    expect(result.svg).toContain('height="10px"');
    expect(result.svg).toContain('viewBox="0 0 20 10"');
    expect(result.pathsRemoved).toBe(1);
  });
});
