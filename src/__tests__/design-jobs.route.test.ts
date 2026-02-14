import { POST } from "@/app/api/design-jobs/route";
import * as service from "@/services/design-job.service";

jest.mock("@/services/design-job.service");

describe("POST /api/design-jobs", () => {
  it("returns 201 with data when service succeeds", async () => {
    const mocked = service.createDesignJob as jest.Mock;
    mocked.mockResolvedValue({
      id: "job_123",
      status: "draft",
      productProfile: { name: "20oz Straight Tumbler", sku: "TMBLR-20OZ-STRAIGHT" },
      machineProfile: { name: "Fiber Galvo 300 Lens", lens: "300mm" },
      createdAt: new Date().toISOString()
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
  });
});
