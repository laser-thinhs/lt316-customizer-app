import { POST as uploadPost } from "@/app/api/assets/route";
import { GET as listAssets } from "@/app/api/design-jobs/[id]/assets/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    designJob: {
      findUnique: jest.fn()
    },
    asset: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  }
}));

describe("assets routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.designJob.findUnique as jest.Mock).mockResolvedValue({ id: "job_1" });
  });

  it("uploads png asset", async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 0, 120, 0, 0, 0, 80
    ]);

    (prisma.asset.create as jest.Mock).mockResolvedValue({
      id: "asset-1",
      designJobId: "job_1",
      kind: "original",
      originalName: "sample.png",
      mimeType: "image/png",
      byteSize: pngBuffer.byteLength,
      filePath: "/tmp/test.png",
      widthPx: 120,
      heightPx: 80,
      createdAt: new Date("2026-02-16T00:00:00.000Z")
    });

    const form = new FormData();
    form.append("designJobId", "job_1");
    form.append("file", new File([pngBuffer], "sample.png", { type: "image/png" }));

    const req = new Request("http://localhost/api/assets", { method: "POST", body: form });
    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.widthPx).toBe(120);
    expect(prisma.asset.create).toHaveBeenCalled();
  });

  it("rejects unsupported file types", async () => {
    const form = new FormData();
    form.append("designJobId", "job_1");
    form.append("file", new File([Buffer.from("hello")], "malware.exe", { type: "application/octet-stream" }));

    const req = new Request("http://localhost/api/assets", { method: "POST", body: form });
    const res = await uploadPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("lists assets oldest to newest", async () => {
    (prisma.asset.findMany as jest.Mock).mockResolvedValue([
      {
        id: "a1",
        designJobId: "job_1",
        kind: "original",
        originalName: "old.png",
        mimeType: "image/png",
        byteSize: 111,
        widthPx: 100,
        heightPx: 50,
        filePath: "old-path",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    const res = await listAssets(new Request("http://localhost"), {
      params: Promise.resolve({ id: "job_1" })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].id).toBe("a1");
    expect(prisma.asset.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "asc" } }));
  });
});
