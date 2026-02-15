import { POST } from "@/app/api/text/outline/route";

describe("text outline route", () => {
  it("returns derived outline object for text", async () => {
    const req = new Request("http://localhost/api/text/outline", {
      method: "POST",
      body: JSON.stringify({
        objectId: "txt_1",
        placement: {
          version: 2,
          canvas: { widthMm: 80, heightMm: 50 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: [
            {
              id: "txt_1",
              kind: "text_line",
              content: "Outline",
              fontFamily: "Inter",
              fontWeight: 400,
              fontStyle: "normal",
              fontSizeMm: 4,
              lineHeight: 1.2,
              letterSpacingMm: 0,
              horizontalAlign: "left",
              verticalAlign: "top",
              rotationDeg: 0,
              anchor: "center",
              offsetXMm: 2,
              offsetYMm: 2,
              boxWidthMm: 20,
              boxHeightMm: 6,
              fillMode: "fill",
              strokeWidthMm: 0,
              mirrorX: false,
              mirrorY: false,
              zIndex: 1,
              allCaps: false
            }
          ]
        }
      })
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.derivedVectorObject.kind).toBe("vector");
    expect(payload.data.derivedVectorObject.sourceTextObjectId).toBe("txt_1");
  });

  it("returns error on invalid source object", async () => {
    const req = new Request("http://localhost/api/text/outline", {
      method: "POST",
      body: JSON.stringify({
        objectId: "missing",
        placement: {
          version: 2,
          canvas: { widthMm: 80, heightMm: 50 },
          machine: { strokeWidthWarningThresholdMm: 0.1 },
          objects: []
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
