import { POST } from "@/app/api/design-jobs/route";
import { PATCH } from "@/app/api/design-jobs/[id]/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    productProfile: { findUnique: jest.fn() },
    machineProfile: { findUnique: jest.fn() },
    designJob: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() }
  }
}));

describe("design-jobs routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/design-jobs returns created job payload", async () => {
    (prisma.productProfile.findUnique as jest.Mock).mockResolvedValue({
      id: "prod_1",
      name: "20oz Straight Tumbler",
      sku: "TMBLR-20OZ-STRAIGHT"
    });
    (prisma.machineProfile.findUnique as jest.Mock).mockResolvedValue({
      id: "mach_1",
      name: "Fiber Galvo 300 Lens",
      lens: "300mm"
    });
    (prisma.designJob.create as jest.Mock).mockResolvedValue({
      id: "job_123",
      status: "draft",
      createdAt: new Date().toISOString(),
      placementJson: {
        version: 3,
        canvas: { widthMm: 50, heightMm: 50 },
        machine: { strokeWidthWarningThresholdMm: 0.1 },
        objects: []
      },
      productProfile: { name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" },
      machineProfile: { name: "Fiber Galvo 300 Lens", lens: "300mm" }
    });

    const req = new Request("http://localhost/api/design-jobs", {
      method: "POST",
      body: JSON.stringify({
        productProfileId: "prod_1",
        machineProfileId: "mach_1",
        placementJson: {
          version: 3,
          canvas: { widthMm: 50, heightMm: 50 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: []
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.data.id).toBe("job_123");
  });

  it("PATCH /api/design-jobs/:id/placement upgrades legacy payload to v3", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({ id: "job_123" });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({
      id: "job_123",
      placementJson: {
        version: 3,
        canvas: { widthMm: 65, heightMm: 40 },
        machine: { strokeWidthWarningThresholdMm: 0.1 },
        objects: []
      },
      updatedAt: "2025-01-01T10:00:00.000Z",
      productProfile: { id: "prod_1", name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" },
      machineProfile: { id: "mach_1", name: "Fiber Galvo 300 Lens", lens: "300mm" },
      assets: []
    });

    const req = new Request("http://localhost/api/design-jobs/job_123", {
      method: "PATCH",
      body: JSON.stringify({
        placementJson: {
          version: 2,
          canvas: { widthMm: 65, heightMm: 40 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: []
        }
      })
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "job_123" }) });
    expect(res.status).toBe(200);
    expect(prisma.designJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { placementJson: expect.any(Object) }
      })
    );

    const json = await res.json();
    expect(json.data.placementJson.version).toBe(3);
  });

  it("PATCH /api/design-jobs/:id returns 422 on strict payload validation errors", async () => {
    const req = new Request("http://localhost/api/design-jobs/job_123", {
      method: "PATCH",
      body: JSON.stringify({
        placementJson: {
          version: 2,
          canvas: { widthMm: 65, heightMm: 40 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: []
        },
        extraField: true
      })
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "job_123" }) });
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.issues[0].code).toBe("unrecognized_keys");
  });

  it("PATCH /api/design-jobs/:id returns 404 for missing design job", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost/api/design-jobs/job_missing", {
      method: "PATCH",
      body: JSON.stringify({
        placementJson: {
          version: 2,
          canvas: { widthMm: 50, heightMm: 50 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: []
        }
      })
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "job_missing" }) });
    expect(res.status).toBe(404);
  });
});
