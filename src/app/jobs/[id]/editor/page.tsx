import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditorClient from "@/components/editor/EditorClient";
import type { PlacementInput } from "@/schemas/placement";

export default async function JobEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.designJob.findUnique({
    where: { id },
    include: { productProfile: true, assets: true }
  });

  if (!job) return notFound();

  return (
    <EditorClient
      jobId={job.id}
      initialPlacement={job.placementJson as PlacementInput}
      profile={{
        diameterMm: Number(job.productProfile.diameterMm),
        engraveZoneHeightMm: Number(job.productProfile.engraveZoneHeightMm)
      }}
      assets={job.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        filename: asset.originalName ?? `${asset.id}.bin`,
        mime: asset.mimeType,
        widthPx: asset.widthPx,
        heightPx: asset.heightPx,
        bytes: asset.byteSize,
        createdAt: asset.createdAt.toISOString(),
        url: `/api/assets/${asset.id}`
      }))}
    />
  );
}
