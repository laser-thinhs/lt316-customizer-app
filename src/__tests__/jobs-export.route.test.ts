import { POST as exportJobPost } from "@/app/api/jobs/[id]/export/route";
import { AppError } from "@/lib/errors";
import { exportDesignJobAsAssets } from "@/services/export-artifact.service";

jest.mock("@/services/export-artifact.service", () => ({
  exportDesignJobAsAssets: jest.fn()
}));

describe("POST /api/jobs/:id/export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns download urls and issues", async () => {
    (exportDesignJobAsAssets as jest.Mock).mockResolvedValue({
      svgUrl: "/api/assets/svg_1",
      manifestUrl: "/api/assets/manifest_1",
      warnings: ["warning"],
      errors: [],
      exportedAt: "2026-01-01T00:00:00.000Z",
      svgByteSize: 256,
      manifestByteSize: 128,
      svg: "<svg />",
      manifest: "{}"
    });

    const res = await exportJobPost(new Request("http://localhost"), { params: Promise.resolve({ id: "job_1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.svgUrl).toBe("/api/assets/svg_1");
    expect(json.data.manifestUrl).toBe("/api/assets/manifest_1");
    expect(json.data.warnings).toEqual(["warning"]);
  });

  it("returns 422 for preflight failures", async () => {
    (exportDesignJobAsAssets as jest.Mock).mockRejectedValue(
      new AppError("Preflight failed", 422, "PREFLIGHT_FAILED")
    );

    const res = await exportJobPost(new Request("http://localhost"), { params: Promise.resolve({ id: "job_2" }) });
    expect(res.status).toBe(422);
  });
});
