import { POST as createBatch } from "@/app/api/batches/route";
import { GET as getBatch } from "@/app/api/batches/[id]/route";
import { GET as getBatchItems } from "@/app/api/batches/[id]/items/route";
import { GET as getErrorsCsv } from "@/app/api/batches/[id]/errors.csv/route";
import { POST as retryFailed } from "@/app/api/batches/[id]/retry-failed/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    template: { findUnique: jest.fn() },
    productProfile: { findUnique: jest.fn() },
    batchRun: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    batchRunItem: { create: jest.fn(), findMany: jest.fn() },
    designJob: { create: jest.fn() },
    auditLog: { create: jest.fn() }
  }
}));

describe("batches API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when API auth is enabled and actor header is missing", async () => {
    const previousRequired = process.env.API_AUTH_REQUIRED;
    const previousRequiredInTest = process.env.API_AUTH_REQUIRED_IN_TEST;

    process.env.API_AUTH_REQUIRED = "true";
    process.env.API_AUTH_REQUIRED_IN_TEST = "true";

    try {
      const res = await createBatch(new Request("http://localhost/api/batches", {
        method: "POST",
        body: JSON.stringify({
          templateId: "tpl_1",
          productProfileId: "prod_1",
          mapping: { first_name: "FirstName" },
          csvContent: "FirstName\nAlice"
        })
      }));
      expect(res.status).toBe(403);
    } finally {
      process.env.API_AUTH_REQUIRED = previousRequired;
      process.env.API_AUTH_REQUIRED_IN_TEST = previousRequiredInTest;
    }
  });

  it("creates batch and transitions status", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({ id: "tpl_1", placementDocument: { objects: [] }, tokenDefinitions: [] });
    (prisma.productProfile.findUnique as jest.Mock).mockResolvedValue({ id: "prod_1", engraveZoneWidthMm: 200, engraveZoneHeightMm: 100 });
    (prisma.batchRun.create as jest.Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.batchRunItem.create as jest.Mock).mockResolvedValue({ id: "item_1" });
    (prisma.designJob.create as jest.Mock).mockResolvedValue({ id: "job_1" });
    (prisma.batchRun.update as jest.Mock).mockResolvedValue({ id: "batch_1", status: "completed", summaryJson: {} });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    const res = await createBatch(new Request("http://localhost/api/batches", {
      method: "POST",
      headers: { "x-actor-role": "operator" },
      body: JSON.stringify({
        templateId: "tpl_1",
        productProfileId: "prod_1",
        mapping: { first_name: "FirstName" },
        csvContent: "FirstName\nAlice"
      })
    }));
    expect(res.status).toBe(201);
  });

  it("returns run details, items, errors csv, and retry", async () => {
    (prisma.batchRun.findUnique as jest.Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.batchRunItem.findMany as jest.Mock)
      .mockResolvedValueOnce([{ rowIndex: 1, status: "success" }])
      .mockResolvedValueOnce([{ rowIndex: 2, status: "failed", errorMessage: "Missing token" }]);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    expect((await getBatch(new Request("http://localhost"), { params: Promise.resolve({ id: "batch_1" }) })).status).toBe(200);
    expect((await getBatchItems(new Request("http://localhost"), { params: Promise.resolve({ id: "batch_1" }) })).status).toBe(200);

    const csvRes = await getErrorsCsv(new Request("http://localhost"), { params: Promise.resolve({ id: "batch_1" }) });
    expect(await csvRes.text()).toContain("rowIndex,error");

    expect((await retryFailed(new Request("http://localhost", { method: "POST", headers: { "x-actor-role": "operator" } }), { params: Promise.resolve({ id: "batch_1" }) })).status).toBe(200);
  });
});
