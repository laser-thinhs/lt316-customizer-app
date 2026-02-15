import { resolveTokenString, validateTokenValues } from "@/lib/vdp";

describe("vdp", () => {
  it("resolves tokens with default syntax", () => {
    const value = resolveTokenString("Property of {{first_name | default:\"Customer\"}}", {});
    expect(value).toBe("Property of Customer");
  });

  it("validates required token definitions", () => {
    const errors = validateTokenValues([{ key: "first_name", label: "First", required: true }], {});
    expect(errors).toEqual(["Missing required token: first_name"]);
  });
});
