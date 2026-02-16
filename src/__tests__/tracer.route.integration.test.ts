import { POST } from "@/app/api/tracer/route";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0t8AAAAASUVORK5CYII=",
  "base64"
);

describe("tracer route integration", () => {
  it("returns svg with viewBox and ok shape", async () => {
    const form = new FormData();
    form.append("file", new File([TINY_PNG], "tiny.png", { type: "image/png" }));
    form.append("settings", JSON.stringify({ output: "fill" }));

    const req = new Request("http://localhost/api/tracer", { method: "POST", body: form });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.result.svg).toContain("<svg");
    expect(json.result.svg).toContain("viewBox");
    expect(typeof json.requestId).toBe("string");
  });
});
