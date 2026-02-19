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
  const normalizePathForAssert = (value: string) => value.replace(/\\/g, "/");

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
    const mkdirPath = (fs.mkdir as jest.Mock).mock.calls[0][0] as string;
    const writePath = (fs.writeFile as jest.Mock).mock.calls[0][0] as string;
    const createdPath = (prisma.asset.create as jest.Mock).mock.calls[0][0].data.filePath as string;

    expect(normalizePathForAssert(mkdirPath)).toBe("/tmp/storage/design-jobs/job_1/asset_1");
    expect((fs.mkdir as jest.Mock).mock.calls[0][1]).toEqual({ recursive: true });
    expect(normalizePathForAssert(writePath)).toBe("/tmp/storage/design-jobs/job_1/asset_1/normalized.svg");
    expect((fs.writeFile as jest.Mock).mock.calls[0][1]).toEqual(expect.any(String));
    expect((fs.writeFile as jest.Mock).mock.calls[0][2]).toBe("utf8");
    expect(normalizePathForAssert(createdPath)).toBe("/tmp/storage/design-jobs/job_1/asset_1/normalized.svg");
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
    const mkdirPath = (fs.mkdir as jest.Mock).mock.calls[0][0] as string;
    const createdPath = (prisma.asset.create as jest.Mock).mock.calls[0][0].data.filePath as string;

    expect(normalizePathForAssert(mkdirPath)).toBe("/tmp/storage/design-jobs/job_1/asset_2");
    expect((fs.mkdir as jest.Mock).mock.calls[0][1]).toEqual({ recursive: true });
    expect(normalizePathForAssert(createdPath)).toBe("/tmp/storage/design-jobs/job_1/asset_2/normalized.svg");
  });
});
