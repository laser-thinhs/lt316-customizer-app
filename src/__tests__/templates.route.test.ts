import { GET as listTemplates, POST as createTemplate } from "@/app/api/templates/route";
import { GET as getTemplate, PATCH } from "@/app/api/templates/[id]/route";
import { POST as applyTemplate } from "@/app/api/templates/[id]/apply/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    template: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    productProfile: { findUnique: jest.fn() },
    designJob: { update: jest.fn() },
    auditLog: { create: jest.fn() }
  }
}));

describe("templates API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates and lists templates", async () => {
    (prisma.template.create as jest.Mock).mockResolvedValue({ id: "tpl_1", slug: "my-template", tokenDefinitions: [] });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    (prisma.template.findMany as jest.Mock).mockResolvedValue([{ id: "tpl_1" }]);

    const createRes = await createTemplate(
      new Request("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "My Template", slug: "my-template", placementDocument: {}, createdBy: "me" })
      })
    );
    expect(createRes.status).toBe(201);

    const listRes = await listTemplates(new Request("http://localhost/api/templates"));
    expect(listRes.status).toBe(200);
  });

  it("gets, patches, and applies template", async () => {
    (prisma.template.findUnique as jest.Mock).mockResolvedValue({ id: "tpl_1", productProfileId: null, placementDocument: {}, tokenDefinitions: [], version: 1, templateHash: "x" });
    (prisma.template.update as jest.Mock).mockResolvedValue({ id: "tpl_1", tokenDefinitions: [] });
    (prisma.productProfile.findUnique as jest.Mock).mockResolvedValue({ id: "prod_1", engraveZoneWidthMm: 100, engraveZoneHeightMm: 100 });
    (prisma.designJob.update as jest.Mock).mockResolvedValue({ id: "job_1" });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    expect((await getTemplate(new Request("http://localhost"), { params: Promise.resolve({ id: "tpl_1" }) })).status).toBe(200);
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "New" }) }), { params: Promise.resolve({ id: "tpl_1" }) })).status).toBe(200);
    expect((await applyTemplate(new Request("http://localhost", { method: "POST", body: JSON.stringify({ targetProductProfileId: "prod_1", designJobId: "job_1" }) }), { params: Promise.resolve({ id: "tpl_1" }) })).status).toBe(200);
  });
});
