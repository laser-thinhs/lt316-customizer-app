import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { exportProofPackage, renderProof } from "@/services/proof.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    designJob: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    asset: { findUnique: jest.fn(), create: jest.fn() },
    productProfile: { findFirst: jest.fn() },
    machineProfile: { findFirst: jest.fn() }
  }
}));

describe("proof service", () => {
  let tempRoot: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "proof-test-"));
    process.env.STORAGE_ROOT = tempRoot;
  });

  it("renderProof creates a png asset", async () => {
    const sourceSvgPath = path.join(tempRoot, "source.svg");
    await fs.writeFile(sourceSvgPath, '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>');

    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({ id: "job1", sourceSvgAssetId: "svg1", proofTemplateId: "40oz_tumbler_wrap" });
    (prisma.asset.findUnique as jest.Mock).mockResolvedValue({ id: "svg1", designJobId: "job1", filePath: sourceSvgPath });
    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "proof1" });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({ id: "job1" });

    const result = await renderProof({ jobId: "job1" });
    expect(result.proofAssetId).toBeTruthy();

    const created = (prisma.asset.create as jest.Mock).mock.calls[0][0].data;
    expect(created.mimeType).toBe("image/png");
    const png = await fs.readFile(created.filePath);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("exportProofPackage zip contains expected files", async () => {
    const sourceSvgPath = path.join(tempRoot, "source.svg");
    const proofPath = path.join(tempRoot, "proof.png");
    await fs.writeFile(sourceSvgPath, '<svg viewBox="0 0 10 10"></svg>');
    await fs.writeFile(proofPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({
      id: "job1",
      sourceSvgAssetId: "svg1",
      proofPngAssetId: "png1",
      proofTemplateId: "40oz_tumbler_wrap",
      proofPlacementJson: null
    });
    (prisma.asset.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "svg1", filePath: sourceSvgPath })
      .mockResolvedValueOnce({ id: "png1", filePath: proofPath });
    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "zip1" });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({ id: "job1" });

    await exportProofPackage("job1");

    const created = (prisma.asset.create as jest.Mock).mock.calls[0][0].data;
    const zip = await fs.readFile(created.filePath);
    const zipText = zip.toString("utf8");
    expect(zipText).toContain("design.svg");
    expect(zipText).toContain("proof.png");
    expect(zipText).toContain("job.json");
    expect(zipText).toContain("README.txt");
  });
});
