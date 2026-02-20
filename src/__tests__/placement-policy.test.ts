import { enforcePolicy, remapDocumentToProfile } from "@/lib/placement-policy";

type DocObject = { xMm: number; widthMm: number };

function firstObject(document: unknown): DocObject {
  const maybeObjects = (document as { objects?: unknown[] }).objects;
  if (!Array.isArray(maybeObjects) || maybeObjects.length === 0) {
    throw new Error("Expected at least one object");
  }

  return maybeObjects[0] as DocObject;
}

describe("placement policy", () => {
  const doc = { objects: [{ id: "o1", xMm: 95, yMm: 0, widthMm: 10, heightMm: 10 }] };

  it("STRICT fails violations", () => {
    const result = enforcePolicy(doc, { widthMm: 100, heightMm: 100 }, "STRICT");
    expect(result.ok).toBe(false);
  });

  it("CLAMP clamps violations", () => {
    const result = enforcePolicy(doc, { widthMm: 100, heightMm: 100 }, "CLAMP");
    expect(result.ok).toBe(true);
    expect(firstObject(result.document).xMm).toBe(90);
  });

  it("SCALE_TO_FIT scales violations", () => {
    const result = enforcePolicy(doc, { widthMm: 100, heightMm: 100 }, "SCALE_TO_FIT");
    expect(result.ok).toBe(true);
    expect(firstObject(result.document).widthMm).toBe(10);
    expect(result.warnings[0]).toContain("Scaled");
  });

  it("remaps between zone sizes", () => {
    const remapped = remapDocumentToProfile({ objects: [{ id: "a", xMm: 10, yMm: 5, widthMm: 20, heightMm: 10 }] }, { widthMm: 100, heightMm: 50 }, { widthMm: 200, heightMm: 100 });
    expect(remapped.document.objects[0].xMm).toBe(20);
    expect(remapped.document.objects[0].widthMm).toBe(40);
  });
});
