import { fail, ok } from "@/lib/response";
import { runPreflight } from "@/lib/domain/preflight";
import { getDesignJobById } from "@/services/design-job.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const job = await getDesignJobById(id);
    const data = runPreflight(job.placementJson, { id: job.productProfileId, name: job.productProfile.name });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
