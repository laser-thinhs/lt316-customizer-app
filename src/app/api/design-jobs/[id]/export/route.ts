import { fail, ok } from "@/lib/response";
import { exportDesignJob } from "@/services/export-artifact.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await exportDesignJob(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
