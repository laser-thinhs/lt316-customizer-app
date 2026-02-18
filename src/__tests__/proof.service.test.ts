import JSZip from "jszip";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    designJob: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock("@/lib/tracer-asset-store", () => ({
  readTracerAsset: jest.fn(),
  createTracerAsset: jest.fn()
}));

import { prisma } from "@/lib/prisma";
import { readTracerAsset, createTracerAsset } from "@/lib/tracer-asset-store";
import * as proofService from "@/services/proof.service";

describe("proof service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderProof returns a PNG payload", async () => {
    (readTracerAsset as jest.Mock).mockResolvedValue({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8"/></svg>')
    });
    (createTracerAsset as jest.Mock).mockResolvedValue({ id: "proof_asset", url: "/api/tracer/assets/proof_asset" });

    const data = await proofService.renderProof({
      svgAssetId: "svg_1",
      templateId: "40oz_tumbler_wrap",
      placementMm: {
        scalePercent: 100,
        rotateDeg: 0,
        xMm: 140,
        yMm: 55,
        mirrorH: false,
        mirrorV: false,
        repeatMode: "none",
        stepMm: 20
      }
    });

    const pngBuffer = (createTracerAsset as jest.Mock).mock.calls[0][0].buffer as Buffer;
    expect(pngBuffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(data.proofAssetId).toBe("proof_asset");
  });

  it("exportProofPackage writes required files to zip", async () => {
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({
      id: "job_1",
      sourceSvgAssetId: "svg_1",
      proofTemplateId: "40oz_tumbler_wrap",
      proofPlacementMmJson: {
        scalePercent: 100,
        rotateDeg: 0,
        xMm: 140,
        yMm: 55,
        mirrorH: false,
        mirrorV: false,
        repeatMode: "none",
        stepMm: 20
      }
    });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({});
    (readTracerAsset as jest.Mock).mockResolvedValue({ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10"/></svg>') });
    (createTracerAsset as jest.Mock)
      .mockResolvedValueOnce({ id: "proof_png", url: "/api/tracer/assets/proof_png" })
      .mockResolvedValueOnce({ id: "zip_asset", url: "/api/tracer/assets/zip_asset" });

    const result = await proofService.exportProofPackage("job_1");
    expect(result.exportAssetId).toBe("zip_asset");

    const zipBuffer = (createTracerAsset as jest.Mock).mock.calls[1][0].buffer as Buffer;
    const zip = await JSZip.loadAsync(zipBuffer);
    const names = Object.keys(zip.files);

    expect(names).toContain("production.svg");
    expect(names).toContain("proof.png");
    expect(names).toContain("template.json");
    expect(names).toContain("placement.json");
    expect(names).toContain("README.txt");
  });
});
