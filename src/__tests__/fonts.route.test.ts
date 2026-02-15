import { GET } from "@/app/api/fonts/route";

describe("fonts route", () => {
  it("returns available self-hosted fonts", async () => {
    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].family).toBeDefined();
  });
});
