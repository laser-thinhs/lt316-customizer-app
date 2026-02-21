import { GET as getManifest } from "@/app/api/templates/yeti/route";
import { GET as getStyle } from "@/app/api/templates/yeti/[styleId]/route";

describe("yeti template routes", () => {
  it("returns manifest with styles/colors/designs", async () => {
    const response = await getManifest();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.product).toBe("yeti");
    expect(body.data.styles.length).toBeGreaterThanOrEqual(2);
    expect(body.data.styles[0].colors.length).toBeGreaterThanOrEqual(2);
    expect(body.data.styles[0].designs[0]).toHaveProperty("gblPath");
    expect(body.data.styles[0].designs[0]).toHaveProperty("previewSvgPath");
  });

  it("returns a style by id", async () => {
    const response = await getStyle(new Request("http://localhost/api/templates/yeti/rambler-20oz"), {
      params: Promise.resolve({ styleId: "rambler-20oz" })
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe("rambler-20oz");
  });
});
