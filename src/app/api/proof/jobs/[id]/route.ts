import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { asAssetPublicUrl } from "@/lib/assets";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await prisma.designJob.findUnique({ where: { id } });
    if (!job) throw new AppError("Job not found", 404, "NOT_FOUND");
    return ok({
      id: job.id,
      sourceSvgAssetId: job.sourceSvgAssetId,
      sourceSvgUrl: job.sourceSvgAssetId ? asAssetPublicUrl(job.sourceSvgAssetId) : null,
      proofPngAssetId: job.proofPngAssetId,
      proofUrl: job.proofPngAssetId ? asAssetPublicUrl(job.proofPngAssetId) : null,
      exportZipAssetId: job.exportZipAssetId,
      exportZipUrl: job.exportZipAssetId ? asAssetPublicUrl(job.exportZipAssetId) : null,
      placement: job.proofPlacementJson,
      templateId: job.proofTemplateId ?? "40oz_tumbler_wrap"
    });
  } catch (error) {
    return fail(error);
  }
}
