import { canonicalSerialize, fingerprint } from "@/lib/canonical";

describe("canonical serializer", () => {
  it("stabilizes key and object ordering", () => {
    const docA = { objects: [{ id: "b", zIndex: 2 }, { zIndex: 1, id: "a" }], zone: { heightMm: 10.0004, widthMm: 20 } };
    const docB = { zone: { widthMm: 20, heightMm: 10.00049 }, objects: [{ id: "a", zIndex: 1 }, { id: "b", zIndex: 2 }] };

    expect(canonicalSerialize(docA)).toEqual(canonicalSerialize(docB));
    expect(fingerprint(docA)).toEqual(fingerprint(docB));
  });
});
