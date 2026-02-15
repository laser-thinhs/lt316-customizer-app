import { POST as uploadPost } from "@/app/api/assets/upload/route";
import { POST as normalizePost } from "@/app/api/assets/[id]/normalize/route";
import { GET as getAsset } from "@/app/api/assets/[id]/route";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      create: jest.fn(),
      findUnique: jest.fn()
    }
  }
}));

describe("assets routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads png asset", async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "asset-1" });

    const form = new FormData();
    form.append("designJobId", "job_1");
    form.append("file", new File([pngBuffer], "sample.png", { type: "image/png" }));

    const req = new Request("http://localhost/api/assets/upload", { method: "POST", body: form });
    const res = await uploadPost(req);

    expect(res.status).toBe(201);
    expect(prisma.asset.create).toHaveBeenCalled();
  });

  it("normalizes svg asset", async () => {
    const testPath = `${process.cwd()}/storage/assets/test/source.svg`;
    await fs.mkdir(`${process.cwd()}/storage/assets/test`, { recursive: true });
    await fs.writeFile(testPath, '<svg><script>alert(1)</script><rect width="10"/></svg>');

    (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
      id: "asset_1",
      designJobId: "job_1",
      mimeType: "image/svg+xml",
      filePath: testPath
    });
    (prisma.asset.create as jest.Mock).mockResolvedValue({ id: "asset_2" });

    const res = await normalizePost(new Request("http://localhost"), { params: Promise.resolve({ id: "asset_1" }) });
    expect(res.status).toBe(201);
  });

  it("returns stored asset bytes", async () => {
    const filePath = `${process.cwd()}/storage/assets/test/read.png`;
    await fs.mkdir(`${process.cwd()}/storage/assets/test`, { recursive: true });
    await fs.writeFile(filePath, Buffer.from([1, 2, 3]));

    (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
      id: "asset_3",
      filePath,
      mimeType: "image/png"
    });

    const res = await getAsset(new Request("http://localhost"), { params: Promise.resolve({ id: "asset_3" }) });
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
