import { getTracerProvider } from "../../lib/tracer-provider";

describe("tracer provider factory", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns local provider by default", () => {
    delete process.env.TRACER_PROVIDER;
    const provider = getTracerProvider();
    expect(provider).toBeDefined();
  });

  it("throws if remote provider has no service url", () => {
    process.env.TRACER_PROVIDER = "remote";
    delete process.env.TRACER_SERVICE_URL;

    expect(() => getTracerProvider()).toThrow("TRACER_SERVICE_URL is required");
  });
});
