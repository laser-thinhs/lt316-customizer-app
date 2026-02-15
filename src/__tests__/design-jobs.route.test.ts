import { POST } from "@/app/api/design-jobs/route";
import { PATCH } from "@/app/api/design-jobs/[id]/placement/route";
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
        widthMm: 50,
        heightMm: 50,
        offsetXMm: 0,
        offsetYMm: 0,
        rotationDeg: 0,
        anchor: "center"
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
          widthMm: 50,
          heightMm: 50,
          offsetXMm: 0,
          offsetYMm: 0,
          rotationDeg: 0,
          anchor: "center"
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.data.id).toBe("job_123");
    expect(json.data.productProfile).toBeDefined();
    expect(json.data.machineProfile).toBeDefined();
  });

  it("PATCH /api/design-jobs/:id/placement updates placement", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({ id: "job_123" });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({
      id: "job_123",
      placementJson: {
        widthMm: 65,
        heightMm: 40,
        offsetXMm: 2,
        offsetYMm: -1,
        rotationDeg: 5,
        anchor: "center"
      },
      productProfile: { id: "prod_1", name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" },
      machineProfile: { id: "mach_1", name: "Fiber Galvo 300 Lens", lens: "300mm" },
      assets: []
    });

    const req = new Request("http://localhost/api/design-jobs/job_123/placement", {
      method: "PATCH",
      body: JSON.stringify({
        placementJson: {
          widthMm: 65,
          heightMm: 40,
          offsetXMm: 2,
          offsetYMm: -1,
          rotationDeg: 5,
          anchor: "center"
        }
      })
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "job_123" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.placementJson.widthMm).toBe(65);
  });
});
