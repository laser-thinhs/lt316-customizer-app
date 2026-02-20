import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { batchExportRequestSchema, batchExportResponseSchema } from "@/schemas/preflight-export";
import { exportDesignJobsBatch } from "@/services/export-artifact.service";

export async function POST(request: Request) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const body = batchExportRequestSchema.parse(await request.json());
    const results = await exportDesignJobsBatch(body.designJobIds);
    return ok(batchExportResponseSchema.parse({ results }));
  } catch (error) {
    return fail(error);
  }
}
