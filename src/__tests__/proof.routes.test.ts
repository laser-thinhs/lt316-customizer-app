import { POST as renderPost } from "@/app/api/proof/render/route";
import { POST as exportPost } from "@/app/api/proof/export/route";
import { renderProof, exportProofPackage } from "@/services/proof.service";

jest.mock("@/services/proof.service", () => ({
  renderProof: jest.fn(),
  exportProofPackage: jest.fn()
}));

describe("proof routes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("POST /api/proof/render returns proof payload", async () => {
    (renderProof as jest.Mock).mockResolvedValue({
      proofAssetId: "asset_1",
      proofUrl: "/api/tracer/assets/asset_1",
      width: 2000,
      height: 786
    });

    const res = await renderPost(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        composition: {
          templateId: "40oz_tumbler_wrap",
          dpi: 300,
          items: [{
            id: "item-1",
            name: "Layer",
            type: "text",
            text: "hello",
            transformMm: { x: 140, y: 55, scale: 1, rotation: 0, flipH: false, flipV: false },
            opacity: 1,
            locked: false,
            hidden: false
          }],
          order: ["item-1"],
          groups: []
        }
      })
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.proofAssetId).toBe("asset_1");
    expect(json.data.width).toBe(2000);
  });

  it("POST /api/proof/export returns zip payload", async () => {
    (exportProofPackage as jest.Mock).mockResolvedValue({
      exportAssetId: "zip_1",
      exportUrl: "/api/tracer/assets/zip_1"
    });

    const res = await exportPost(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job_1" })
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.exportAssetId).toBe("zip_1");
  });
});
