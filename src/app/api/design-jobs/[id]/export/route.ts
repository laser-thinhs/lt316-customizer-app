import { fail, ok } from "@/lib/response";
import { requireApiRole } from "@/lib/api-auth";
import { exportDesignJob } from "@/services/export-artifact.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    requireApiRole(request, ["admin", "operator"]);
    const { id } = await params;
    const data = await exportDesignJob(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
