import { POST as PreflightPost } from "@/app/api/design-jobs/[id]/preflight/route";
import { POST as ExportSvgPost } from "@/app/api/design-jobs/[id]/export/svg/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    designJob: { findUnique: jest.fn() }
  }
}));

const baseJob = {
  id: "job_1",
  productProfileId: "prod_1",
  productProfile: { id: "prod_1", name: "20oz", sku: "SKU" },
  machineProfile: { id: "mach", name: "Fiber", lens: "300mm" },
  assets: [],
  placementJson: {
    version: 3,
    canvas: { widthMm: 100, heightMm: 50 },
    machine: { strokeWidthWarningThresholdMm: 0.1 },
    wrap: {
      enabled: true,
      diameterMm: 87,
      wrapWidthMm: 273.319,
      seamXmm: 0,
      seamSafeMarginMm: 3,
      microOverlapMm: 0.9
    },
    objects: [
      {
        id: "vec1",
        kind: "vector",
        pathData: "M0 0L10 10",
        boxWidthMm: 10,
        boxHeightMm: 10,
        offsetXMm: 10,
        offsetYMm: 10,
        rotationDeg: 0,
        anchor: "top-left",
        mirrorX: false,
        mirrorY: false,
        zIndex: 0
      }
    ]
  }
};

describe("design job preflight/export routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /preflight returns typed payload", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue(baseJob);

    const response = await PreflightPost(new Request("http://localhost/api/design-jobs/job_1/preflight", { method: "POST" }), {
      params: Promise.resolve({ id: "job_1" })
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(typeof json.data.ok).toBe("boolean");
    expect(json.data.metrics.wrapWidthMm).toBeDefined();
  });

  it("POST /preflight returns 404 for invalid job id", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await PreflightPost(new Request("http://localhost/api/design-jobs/missing/preflight", { method: "POST" }), {
      params: Promise.resolve({ id: "missing" })
    });

    expect(response.status).toBe(404);
  });

  it("POST /export/svg returns svg with mm dimensions", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue(baseJob);

    const response = await ExportSvgPost(new Request("http://localhost/api/design-jobs/job_1/export/svg?guides=1", { method: "POST" }), {
      params: Promise.resolve({ id: "job_1" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    const body = await response.text();
    expect(body.startsWith("<?xml")).toBe(true);
    expect(body).toContain('width="100mm"');
    expect(body).toContain('height="50mm"');
  });
});
