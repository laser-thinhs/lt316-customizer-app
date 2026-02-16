import { promises as fs } from "node:fs";
import { POST as normalizePost } from "@/app/api/assets/[id]/normalize/route";
import { prisma } from "@/lib/prisma";

jest.mock("node:fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findUnique: jest.fn(),
      create: jest.fn()
    }
  }
}));

describe("POST /api/assets/[id]/normalize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from("<svg></svg>"));
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it("writes normalized output to an asset-specific directory for legacy shared paths", async () => {
    (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
      id: "asset_1",
      designJobId: "job_1",
      kind: "original",
      originalName: "logo.svg",
      mimeType: "image/svg+xml",
      byteSize: 11,
      filePath: "/tmp/storage/design-jobs/job_1/asset_1-logo.svg"
    });

    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "norm_1" });

    const res = await normalizePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "asset_1" })
    });

    expect(res.status).toBe(201);
    expect(fs.mkdir).toHaveBeenCalledWith("/tmp/storage/design-jobs/job_1/asset_1", {
      recursive: true
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      "/tmp/storage/design-jobs/job_1/asset_1/normalized.svg",
      expect.any(String),
      "utf8"
    );
    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filePath: "/tmp/storage/design-jobs/job_1/asset_1/normalized.svg"
        })
      })
    );
  });

  it("keeps using the current directory when the asset is already isolated", async () => {
    (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
      id: "asset_2",
      designJobId: "job_1",
      kind: "original",
      originalName: "logo.svg",
      mimeType: "image/svg+xml",
      byteSize: 11,
      filePath: "/tmp/storage/design-jobs/job_1/asset_2/asset_2-logo.svg"
    });

    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "norm_2" });

    const res = await normalizePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "asset_2" })
    });

    expect(res.status).toBe(201);
    expect(fs.mkdir).toHaveBeenCalledWith("/tmp/storage/design-jobs/job_1/asset_2", {
      recursive: true
    });
    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filePath: "/tmp/storage/design-jobs/job_1/asset_2/normalized.svg"
        })
      })
    );
  });
});
