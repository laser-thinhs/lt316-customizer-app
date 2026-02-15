import { fingerprint } from "@/lib/canonical";

export async function renderProofImage(input: {
  placementDocument: unknown;
  productProfileId: string;
  rowIndex?: number;
}) {
  const hash = fingerprint({
    profile: input.productProfileId,
    placement: input.placementDocument
  });

  return {
    imagePath: `/proofs/${hash}${input.rowIndex != null ? `-${input.rowIndex}` : ""}.png`,
    metadata: {
      engineVersion: "proof-renderer@2.2",
      fontSetHash: "default-fontset-v1",
      renderedAt: new Date(0).toISOString()
    }
  };
}
