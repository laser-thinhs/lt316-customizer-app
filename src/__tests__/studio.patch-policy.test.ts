import { validatePatchAgainstPolicy } from "@/lib/studio/patch-policy";

describe("validatePatchAgainstPolicy", () => {
  it("rejects forbidden paths", () => {
    const patch = [
      "diff --git a/.git/config b/.git/config",
      "--- a/.git/config",
      "+++ b/.git/config",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    const result = validatePatchAgainstPolicy(patch);
    expect(result.errors.some((msg) => msg.includes("Forbidden patch path"))).toBe(true);
  });

  it("enforces patch size limits", () => {
    const giantBody = "a".repeat(210 * 1024);
    const patch = `diff --git a/src/studio/a.ts b/src/studio/a.ts\n--- a/src/studio/a.ts\n+++ b/src/studio/a.ts\n@@ -1 +1 @@\n-${giantBody}\n+x`;

    const result = validatePatchAgainstPolicy(patch);
    expect(result.errors.some((msg) => msg.includes("max size"))).toBe(true);
  });
});
