import { fail, ok } from "@/lib/response";
import { BedLayout, JobStatus, ProductionConfig } from "@/core/v2/types";
import { isV2JobId, updateV2Job } from "@/lib/v2/jobs-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isV2JobId(id)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "V2 job not found" } }, { status: 404 });
    }
    const body = await request.json();
    const updated = await updateV2Job(id, {
      status: body.status as JobStatus | undefined,
      productionConfig: body.productionConfig as ProductionConfig | undefined,
      bedLayout: body.bedLayout as BedLayout | undefined,
      bedPresetId: body.bedPresetId as string | undefined,
      bedLayoutOverrideEnabled: body.bedLayoutOverrideEnabled as boolean | undefined,
      bedLayoutOverride: body.bedLayoutOverride as BedLayout | undefined,
      selectedAdminAssetIds: body.selectedAdminAssetIds as string[] | undefined
    });
    if (!updated) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Design job not found" } }, { status: 404 });
    }
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
