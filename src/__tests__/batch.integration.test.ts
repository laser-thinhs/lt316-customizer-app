import { createBatchRun, retryFailed } from "@/services/batch.service";
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

describe("batch integration", () => {
  it("handles mixed valid/invalid rows and retry failed path", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({
      id: "tpl_1",
      placementDocument: { objects: [{ id: "txt", xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, text: "{{first_name}}" }] },
      tokenDefinitions: [{ key: "first_name", label: "First", required: true }]
    });
    (prisma.productProfile.findUnique as jest.Mock).mockResolvedValue({ id: "prod_1", engraveZoneWidthMm: 100, engraveZoneHeightMm: 100 });
    (prisma.batchRun.create as jest.Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.batchRun.update as jest.Mock).mockResolvedValue({ id: "batch_1", status: "partial", summaryJson: {}});
    (prisma.batchRun.findUnique as jest.Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.batchRunItem.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: `item_${data.rowIndex}` }));
    (prisma.designJob.create as jest.Mock).mockResolvedValue({ id: "job_1" });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    const rows = ["FirstName", "Alice", "", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"].join("\n");
    const run = await createBatchRun({
      templateId: "tpl_1",
      productProfileId: "prod_1",
      mapping: { first_name: "FirstName" },
      csvContent: rows
    });

    expect(run.status).toBe("partial");
    expect(prisma.batchRunItem.create).toHaveBeenCalledTimes(9);

    const retry = await retryFailed("batch_1");
    expect(retry.id).toBe("batch_1");
  });
});
